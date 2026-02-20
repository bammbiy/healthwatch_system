import { Request, Response } from 'express';
import { PatientModel, VitalSigns } from '../models/Patient';
import { VitalSignsModel } from '../models/VitalSigns';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { RedisService } from '../services/RedisService';

export class PatientController {
  
  static async getAllPatients(req: AuthenticatedRequest, res: Response) {
    try {
      const { page, limit, status, search } = req.query;
      
      const options = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        status: status as string,
        search: search as string
      };

      const result = await PatientModel.findAll(options);
      
      res.json({
        success: true,
        data: result.patients,
        pagination: {
          page: options.page,
          limit: options.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / options.limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching patients:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch patients'
      });
    }
  }

  static async getPatientById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid patient ID required'
        });
      }

    
      const cacheKey = `patient:${id}`;
      const cached = await RedisService.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true
        });
      }

      const patient = await PatientModel.findById(parseInt(id));
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found'
        });
      }

      // Cache the result for 5 minutes
      await RedisService.set(cacheKey, JSON.stringify(patient), 300);

      res.json({
        success: true,
        data: patient
      });
    } catch (error) {
      logger.error('Error fetching patient:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch patient'
      });
    }
  }

  static async createPatient(req: AuthenticatedRequest, res: Response) {
    try {
      const patientData = req.body;
      
    
      if (!patientData.admissionDate) {
        patientData.admissionDate = new Date().toISOString().split('T')[0];
      }

      const newPatient = await PatientModel.create(patientData);
      
      logger.info(`Patient created: ${newPatient.id} by user ${req.user?.id}`);
      
      res.status(201).json({
        success: true,
        data: newPatient,
        message: 'Patient created successfully'
      });
    } catch (error: any) {
      logger.error('Error creating patient:', error);
      
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({
          success: false,
          error: 'Medical record number already exists'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create patient'
      });
    }
  }

  static async updatePatient(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid patient ID required'
        });
      }

      const updatedPatient = await PatientModel.update(parseInt(id), updates);
      
      if (!updatedPatient) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found'
        });
      }

      // Invalidate cache
      await RedisService.del(`patient:${id}`);
      
      logger.info(`Patient updated: ${id} by user ${req.user?.id}`);
      
      res.json({
        success: true,
        data: updatedPatient,
        message: 'Patient updated successfully'
      });
    } catch (error: any) {
      logger.error('Error updating patient:', error);
      
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'Medical record number already exists'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update patient'
      });
    }
  }

  static async deletePatient(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid patient ID required'
        });
      }

      const success = await PatientModel.delete(parseInt(id));
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found'
        });
      }

      // Invalidate cache
      await RedisService.del(`patient:${id}`);
      
      logger.info(`Patient deleted: ${id} by user ${req.user?.id}`);
      
      res.json({
        success: true,
        message: 'Patient deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting patient:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete patient'
      });
    }
  }

  static async getPatientsWithAlerts(req: AuthenticatedRequest, res: Response) {
    try {
      const patients = await PatientModel.getPatientsWithAlerts();
      
      res.json({
        success: true,
        data: patients,
        count: patients.length
      });
    } catch (error) {
      logger.error('Error fetching patients with alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch patients with alerts'
      });
    }
  }

  static async getPatientAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { days } = req.query;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid patient ID required'
        });
      }

      const analyticsDays = days ? parseInt(days as string) : 7;
      const analytics = await PatientModel.getAnalytics(parseInt(id), analyticsDays);
      
      res.json({
        success: true,
        data: analytics,
        period: `${analyticsDays} days`
      });
    } catch (error) {
      logger.error('Error fetching patient analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch patient analytics'
      });
    }
  }

  static async getVitalSignsHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { page, limit, hours } = req.query;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid patient ID required'
        });
      }

      const options = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        hours: hours ? parseInt(hours as string) : 24
      };

      const vitalSigns = await VitalSignsModel.findByPatientId(parseInt(id), options);
      
      res.json({
        success: true,
        data: vitalSigns
      });
    } catch (error) {
      logger.error('Error fetching vital signs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch vital signs'
      });
    }
  }

  static async addVitalSigns(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const vitalSignsData: Omit<VitalSigns, 'id' | 'recordedAt'> = {
        ...req.body,
        patientId: parseInt(id),
        recordedBy: req.user!.id
      };

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid patient ID required'
        });
      }

      const newVitalSigns = await VitalSignsModel.create(vitalSignsData);
      
      // Invalidate patient cache
      await RedisService.del(`patient:${id}`);
      
      logger.info(`Vital signs added for patient ${id} by user ${req.user?.id}`);
      
      res.status(201).json({
        success: true,
        data: newVitalSigns,
        message: 'Vital signs recorded successfully'
      });
    } catch (error) {
      logger.error('Error adding vital signs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record vital signs'
      });
    }
  }
}