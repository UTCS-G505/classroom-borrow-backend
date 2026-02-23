const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleController');
const {
  authenticateToken,
  authorizeAdmin,
} = require('../middleware/authMiddleware');

// GET /bookings/schedule?date=...&classroom_id=...
router.get(
  '/',
  /*  
        #swagger.description = '取得特定時間教室的行程'
        #swagger.parameters['date'] = {
            in: 'query',
            description: '(日期)YYYY-MM-DD',
            required: true,
            schema: "2025-11-20"
        }  

        #swagger.parameters['classroom_id'] = {
            in: 'query',
            description: '教室id',
            required: true,
            schema: "C101"
        }     
                
        #swagger.responses[200] = { 
        schema: [
            {
                "schedule_id": 1,
                "classroom_id": "C101",
                "date": "2025-11-20T00:00:00.000Z",
                "time_slot": "09:00-11:00",
                "booked_by": 4,
                "borrow_request_id": 2,
                "event_name": "英文戲劇社演出",
                "status": "已預約"
            },
        ]} 
    */
  controller.getSchedule
);

router.put(
  '/:id',
  authenticateToken,
  authorizeAdmin,
  /*
        #swagger.description = '管理員更新課表'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '課表編號',
            required: true,
            schema: "1"
        }
        #swagger.parameters['body'] = {
            in: 'body',
            description: '可更新欄位',
            required: true,
            schema: {
                "event_name": "英文戲劇社演出",
                "status": "已預約"
            }
        }
    */
  controller.updateSchedule
);

module.exports = router;
