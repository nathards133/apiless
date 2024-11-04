import express from 'express';
import { auth } from '../middleware/auth.js';
import RepositoryFactory from '../repositories/RepositoryFactory.js';

const router = express.Router();
const reportRepository = RepositoryFactory.getServiceOrderReportRepository();

// Get service orders report
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    const report = await reportRepository.generateReport({
      userId: req.user._id,
      startDate,
      endDate,
      status
    });
    
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Export report to Excel
router.get('/export', auth, async (req, res) => {
  try {
    const { startDate, endDate, status, format = 'excel' } = req.query;
    
    const reportData = await reportRepository.exportReport(
      {
        userId: req.user._id,
        startDate,
        endDate,
        status
      },
      format
    );

    // Configurar headers para download
    const filename = `service-orders-report-${format === 'excel' ? 'xlsx' : 'csv'}`;
    res.setHeader('Content-Type', format === 'excel' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    res.send(reportData);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ message: 'Error exporting report' });
  }
});

export default router; 