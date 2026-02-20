import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { VitalSignsModel } from '../models/VitalSigns';
import { PatientModel } from '../models/Patient';
import { logger } from '../utils/logger';
import { RedisService } from './RedisService';

export class SocketService {
  private io: Server;
  private connectedUsers: Map<string, { userId: number; role: string; socketId: string }> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  public initialize() {
    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));
  }

  private async authenticateSocket(socket: Socket, next: (err?: Error) => void) {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      if (!process.env.JWT_SECRET) {
        return next(new Error('JWT_SECRET not configured'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      
      // Store user info in socket
      (socket as any).userId = decoded.id;
      (socket as any).userRole = decoded.role;
      (socket as any).userName = decoded.username;
      
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  }

  private handleConnection(socket: Socket) {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;
    const userName = (socket as any).userName;

    logger.info(`User connected: ${userName} (${userRole}) - Socket ID: ${socket.id}`);

    // Store connected user
    this.connectedUsers.set(socket.id, { 
      userId, 
      role: userRole, 
      socketId: socket.id 
    });

    // Join role-based rooms
    socket.join(`role:${userRole}`);
    socket.join(`user:${userId}`);

    // Send current alert count
    this.sendAlertCount(socket);

    // Handle vital signs submission
    socket.on('submit_vital_signs', this.handleVitalSignsSubmission.bind(this, socket));

    // Handle patient monitoring subscription
    socket.on('monitor_patient', this.handlePatientMonitoring.bind(this, socket));

    // Handle alert acknowledgment
    socket.on('acknowledge_alert', this.handleAlertAcknowledgment.bind(this, socket));

    // Handle real-time vital signs from devices
    socket.on('device_vital_signs', this.handleDeviceVitalSigns.bind(this, socket));

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${userName} - Socket ID: ${socket.id}`);
      this.connectedUsers.delete(socket.id);
    });

    // Send welcome message
    socket.emit('connection_established', {
      message: 'Connected to HealthWatch Pro',
      user: { id: userId, role: userRole, name: userName }
    });
  }

  private async sendAlertCount(socket: Socket) {
    try {
      const alerts = await PatientModel.getPatientsWithAlerts();
      socket.emit('alert_count', { count: alerts.length });
    } catch (error) {
      logger.error('Error sending alert count:', error);
    }
  }

  private async handleVitalSignsSubmission(socket: Socket, data: any) {
    try {
      const userId = (socket as any).userId;
      const userRole = (socket as any).userRole;

      // Validate user permissions
      if (!['doctor', 'nurse', 'technician'].includes(userRole)) {
        socket.emit('error', { message: 'Insufficient permissions to submit vital signs' });
        return;
      }

      // Validate required data
      if (!data.patientId) {
        socket.emit('error', { message: 'Patient ID is required' });
        return;
      }

      // Add vital signs to database
      const vitalSignsData = {
        ...data,
        recordedBy: userId,
        isManual: true
      };

      const newVitalSigns = await VitalSignsModel.create(vitalSignsData);

      // Broadcast to all users monitoring this patient
      this.io.to(`patient:${data.patientId}`).emit('vital_signs_updated', {
        patientId: data.patientId,
        vitalSigns: newVitalSigns,
        recordedBy: (socket as any).userName
      });

      // Check for alerts and broadcast if any
      const alerts = await PatientModel.getPatientsWithAlerts();
      const patientAlerts = alerts.filter(alert => alert.id === data.patientId);
      
      if (patientAlerts.length > 0) {
        this.broadcastAlert(patientAlerts[0]);
      }

      socket.emit('vital_signs_submitted', {
        success: true,
        data: newVitalSigns
      });

      logger.info(`Vital signs submitted for patient ${data.patientId} by user ${userId}`);

    } catch (error) {
      logger.error('Error handling vital signs submission:', error);
      socket.emit('error', { message: 'Failed to submit vital signs' });
    }
  }

  private async handlePatientMonitoring(socket: Socket, data: { patientId: number }) {
    try {
      const { patientId } = data;
      
      // Join patient-specific room
      socket.join(`patient:${patientId}`);
      
      // Send current patient data
      const patient = await PatientModel.findById(patientId);
      if (patient) {
        socket.emit('patient_data', patient);
      }

      socket.emit('monitoring_started', { patientId });
      
      logger.info(`User ${(socket as any).userName} started monitoring patient ${patientId}`);
    } catch (error) {
      logger.error('Error handling patient monitoring:', error);
      socket.emit('error', { message: 'Failed to start patient monitoring' });
    }
  }

  private async handleAlertAcknowledgment(socket: Socket, data: { alertId: number }) {
    try {
      const userId = (socket as any).userId;
      const userRole = (socket as any).userRole;

      if (!['doctor', 'nurse'].includes(userRole)) {
        socket.emit('error', { message: 'Insufficient permissions to acknowledge alerts' });
        return;
      }

      this.io.emit('alert_acknowledged', {
        alertId: data.alertId,
        acknowledgedBy: (socket as any).userName,
        acknowledgedAt: new Date()
      });

      socket.emit('alert_acknowledged_success', { alertId: data.alertId });

      logger.info(`Alert ${data.alertId} acknowledged by user ${userId}`);
    } catch (error) {
      logger.error('Error handling alert acknowledgment:', error);
      socket.emit('error', { message: 'Failed to acknowledge alert' });
    }
  }

  private async handleDeviceVitalSigns(socket: Socket, data: any) {
    try {
      const userId = (socket as any).userId;

      if (!data.deviceId || !data.patientId) {
        socket.emit('error', { message: 'Device ID and Patient ID are required' });
        return;
      }

      const vitalSignsData = {
        ...data,
        recordedBy: userId,
        isManual: false,
        deviceId: data.deviceId
      };

      const newVitalSigns = await VitalSignsModel.create(vitalSignsData);

      // Broadcast to all users
      this.io.to(`patient:${data.patientId}`).emit('device_vital_signs_received', {
        patientId: data.patientId,
        vitalSigns: newVitalSigns,
        deviceId: data.deviceId
      });

      await RedisService.set(
        `latest_vitals:${data.patientId}`,
        JSON.stringify(newVitalSigns),
        300 
      );

      logger.info(`Device vital signs received for patient ${data.patientId} from device ${data.deviceId}`);

    } catch (error) {
      logger.error('Error handling device vital signs:', error);
      socket.emit('error', { message: 'Failed to process device vital signs' });
    }
  }

  public broadcastAlert(alertData: any) {
    this.io.to('role:doctor').to('role:nurse').emit('new_alert', {
      type: 'medical_alert',
      patientId: alertData.id,
      patientName: alertData.name,
      alertType: alertData.alert_type,
      message: `Alert for ${alertData.name}: ${alertData.alert_type}`,
      severity: this.getAlertSeverity(alertData),
      timestamp: new Date(),
      roomNumber: alertData.room_number
    });

    logger.info(`Alert broadcasted for patient ${alertData.id}: ${alertData.alert_type}`);
  }

  private getAlertSeverity(alertData: any): 'low' | 'medium' | 'high' | 'critical' {
    if (alertData.heart_rate > 150 || alertData.heart_rate < 40) return 'critical';
    if (alertData.temperature > 39.5 || alertData.temperature < 35.0) return 'critical';
    if (alertData.oxygen_saturation < 90) return 'critical';
    if (alertData.blood_pressure_systolic > 180 || alertData.blood_pressure_systolic < 70) return 'critical';
    
    return 'high'; 
  }

  public broadcastMessage(message: string, roomOrRole?: string) {
    if (roomOrRole) {
      this.io.to(roomOrRole).emit('broadcast_message', {
        message,
        timestamp: new Date(),
        type: 'system'
      });
    } else {
      this.io.emit('broadcast_message', {
        message,
        timestamp: new Date(),
        type: 'system'
      });
    }
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getConnectedUsersByRole(role: string): number {
    return Array.from(this.connectedUsers.values()).filter(user => user.role === role).length;
  }
}