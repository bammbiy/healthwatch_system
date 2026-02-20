import express from 'express';
import { PatientController } from '../controllers/PatientController';
import { requireRole } from '../middleware/auth';
import { validatePatient } from '../middleware/validation';

const router = express.Router();

// Get all patients with pagination and filters
router.get('/', PatientController.getAllPatients);

// Get patient by ID
router.get('/:id', PatientController.getPatientById);

// Create new patient 
router.post(
  '/',
  requireRole(['doctor', 'nurse', 'admin']),
  validatePatient,
  PatientController.createPatient
);

// Update patient
router.put(
  '/:id',
  requireRole(['doctor', 'nurse', 'admin']),
  PatientController.updatePatient
);

// Delete patient 
router.delete(
  '/:id',
  requireRole(['doctor', 'admin']),
  PatientController.deletePatient
);

// Get patients with active alerts
router.get('/alerts/active', PatientController.getPatientsWithAlerts);

// Get patient analytics
router.get('/:id/analytics', PatientController.getPatientAnalytics);

// Get patient vital signs history
router.get('/:id/vital-signs', PatientController.getVitalSignsHistory);

// Add vital signs to patient
router.post(
  '/:id/vital-signs',
  requireRole(['doctor', 'nurse', 'technician']),
  PatientController.addVitalSigns
);

export default router;