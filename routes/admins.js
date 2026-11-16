const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminsController');
const scheduleController = require('../controllers/scheduleController');
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

router.get(
  '/blacklist',
  /* 
        #swagger.description = '取得所有黑名單'
        #swagger.responses[200] = { 
            schema: [
                {
                    "blacklist_id": 1,
                    "user_id": "abc-123",
                    "reason": "違規使用",
                    "created_at": "2025-11-29T16:27:57.000Z",
                    "expired_at": "2026-01-01T00:00:00.000Z",
                    "user_name": "王小明",
                    "user_email": "wang@example.com"
                }
            ]} 
    */
  controller.getAllBlacklist
);

router.post(
  '/bookings',
  /*
        #swagger.description = '管理員依「場地及設備租借表」代為新增借用（直接核准，可一次多筆，任一筆衝突則整批不新增）'
        #swagger.parameters['body'] = {
            in: 'body',
            description: '借用資料陣列',
            required: true,
            schema: {
                "bookings": [
                    {
                        "classroom_id": "CCHALL",
                        "borrow_type": "單次借用",
                        "start_date": "2026-12-01",
                        "start_time": "08:00",
                        "end_time": "12:00",
                        "event_name": "年度成果發表會",
                        "people_count": 300,
                        "borrower_department": "臺北市某某協會",
                        "borrower_name": "王小明",
                        "borrower_phone": "0912-345678",
                        "borrower_email": "",
                        "reason": "【場地及設備租借表】選用設備：大型投影機(時) × 1"
                    }
                ]
            }
        }
        #swagger.responses[201] = {
            schema: {
                "message": "已新增 1 筆借用",
                "bookings": [
                    { "request_id": 12, "public_id": "uuid", "classroom_id": "CCHALL", "start_date": "2026-12-01" }
                ]
            }
        }
        #swagger.responses[409] = {
            schema: {
                "error": "第 1 筆（CCHALL）已被其他申請單預約或正在審核中（衝突日期：2026-12-01），整批未新增。",
                "index": 0,
                "conflict_type": "booking",
                "conflict_date": "2026-12-01"
            }
        }
    */
  controller.createBookings
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

router.get(
  '/users',
  /* 
        #swagger.description = '取得所有使用者清單及黑名單狀態'
    */
  controller.getAllUsers
);

router.put(
  '/users/:id/role',
  /* 
        #swagger.description = '更改使用者權限'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '使用者ID',
            required: true
        }
        #swagger.parameters['body'] = {
            in: 'body',
            description: '新權限值',
            required: true,
            schema: {
                "role": 1
            }
        } 
    */
  controller.updateUserRole
);

router.get('/schedules', scheduleController.getAllSchedules);
router.post('/schedules/import', scheduleController.importSchedule);
router.delete('/schedules/clear', scheduleController.clearSchedules);
router.delete(
  '/schedules/semester',
  scheduleController.deleteSemesterSchedules
);

module.exports = router;
