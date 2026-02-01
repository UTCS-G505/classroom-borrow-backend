const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminsController');
const {
  authenticateToken,
  authorizeAdmin,
} = require('../middleware/authMiddleware');

// Apply authentication and admin authorization to all admin routes
router.use(authenticateToken);
router.use(authorizeAdmin);

router.get(
  '/bookings',
  /* 
        #swagger.description = '取得所有申請'
        #swagger.responses[200] = { 
            schema: [
                {
                    "request_id": 3,
                    "user_id": 1,
                    "classroom_id": "R201",
                    "borrow_type": "多次借用",
                    "start_date": "2025-10-01T00:00:00.000Z",
                    "end_date": "2025-12-31T00:00:00.000Z",
                    "start_time": "18:00:00",
                    "end_time": "20:00:00",
                    "event_name": "程式設計作業輔導",
                    "people_count": 20,
                    "teacher_name": "李老師",
                    "reason": "每週二晚間固定輔導",
                    "status": "核准",
                    "reject_reason": null,
                    "created_at": "2025-11-29T16:27:57.000Z",
                    "teacher_department": "音樂系",
                    "teacher_phone": "02-1234-5678",
                    "teacher_email": "teacher01@example.edu",
                    "borrower_department": "資訊系",
                    "borrower_phone": "0912-000001",
                    "borrower_email": "s001@example.edu"
                },
                {
                    "request_id": 4,
                    "user_id": 1,
                    "classroom_id": "H01",
                    "borrow_type": "單次借用",
                    "start_date": "2025-11-05T00:00:00.000Z",
                    "end_date": null,
                    "start_time": "10:00:00",
                    "end_time": "12:00:00",
                    "event_name": "大型繪畫工作坊",
                    "people_count": 25,
                    "teacher_name": "林老師",
                    "reason": "活動需要較多空間",
                    "status": "退件",
                    "reject_reason": "場地與設備不可同時租借",
                    "created_at": "2025-11-29T16:27:57.000Z",
                    "teacher_department": "視覺設計系",
                    "teacher_phone": "02-2345-6789",
                    "teacher_email": "teacher02@example.edu",
                    "borrower_department": "資訊系",
                    "borrower_phone": "0912-000001",
                    "borrower_email": "s001@example.edu"
                }
        ]} 
    */
  controller.getAllBookings
);
router.put(
  '/bookings/:id/status',
  /* 
        #swagger.description = '審核特定申請'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '申請編號',
            required: true,
            schema: "3"
        }
        #swagger.parameters['body'] = {
            in: 'body',
            description: '新增申請內容',
            required: true,
            schema: {
                "status": "approved",
                "reject_reason": "test1"
            }
        } 
        #swagger.responses[200] = { 
            schema: 	
            {
                "message": "已審核",
                "request_id": 0
            }
        } 
    */
  controller.updateBookings
);
router.post(
  '/announcements',
  /* 
        #swagger.description = '新增公告'
        #swagger.parameters['body'] = {
            in: 'body',
            description: '新增申請內容',
            required: true,
            schema: {
                "title": "test1",
                "content": "test2",
                "expired_at": "2025-11-24"
            }
        } 
        #swagger.responses[200] = { 
            schema: 	
            {
                "message": "公告已建立",
                "request_id": 4
            }
        } 
    */
  controller.postAnnouncement
);
router.post(
  '/blacklist',
  /* 
        #swagger.description = '新增黑名單'
        #swagger.parameters['body'] = {
            in: 'body',
            description: '新增申請內容',
            required: true,
            schema: {
                "user_id": 1,
                "reason": "test1",
                "expired_at": "2025-10-30"
            }
        } 
        #swagger.responses[200] = { 
            schema: 	
            {
                "message": "黑名單已更新",
                "request_id": 2
            }   
        } 
    */
  controller.postBlacklist
);
router.delete(
  '/blacklist/:id',
  /* 
        #swagger.description = '刪除黑名單'
        #swagger.parameters['id'] = {
            in: 'path',
            description: 'user_id',
            required: true,
            schema: 2
        }
        #swagger.responses[200] = { 
            schema: 	
            {
                "message": "黑名單已更新",
                "request_id": 0
            } 
        } 
    */
  controller.deleteBlackList
);

module.exports = router;
