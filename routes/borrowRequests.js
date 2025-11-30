const express = require('express');
const router = express.Router();
const controller = require('../controllers/borrowRequestsController');

router.get('/', 
    /* 
        #swagger.description = '查看自己的申請 *管理員會回傳所有申請'
        #swagger.parameters['body'] = {
            in: 'body',
            description: '身分與id',
            required: true,
            schema: {
                "id": "1",
                "role": "students"
            }
        } 
        #swagger.responses[200] = { 
            schema: 	
            {
                {
                    "request_id": 3,
                    "borrower_id": 1,
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
                    "borrower_id": 1,
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
            }
        } 
    */
    controller.getBookings);
router.get('/:id', 
    /*
        /* 
        #swagger.description = '取得特定申請'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '申請id',
            required: true,
            schema: 7
        }
        #swagger.responses[200] = { 
            schema: 	
            {
                "request_id": 7,
                "borrower_id": 4,
                "classroom_id": "C102",
                "borrow_type": "多次借用",
                "start_date": "2025-11-05T00:00:00.000Z",
                "end_date": null,
                "start_time": "13:00:00",
                "end_time": "15:00:00",
                "event_name": "社團活動",
                "people_count": 25,
                "teacher_name": "王老師",
                "reason": "舉辦迎新活動",
                "status": "審核中",
                "reject_reason": null,
                "created_at": "2025-11-30T06:08:56.000Z",
                "teacher_department": null,
                "teacher_phone": null,
                "teacher_email": null,
                "borrower_department": null,
                "borrower_phone": null,
                "borrower_email": null
            }
        } 
    */
    controller.getBookingssByid);
router.post('/', 
    /*
        #swagger.description = '新增申請'
        #swagger.parameters['body'] = {
            in: 'body',
            description: '新增申請內容',
            required: true,
            schema: {
                "classroom_id": "C102",
                "borrow_type": "多次借用",
                "start_date": "2025-11-05",
                "start_time": "13:00",
                "end_time": "15:00",
                "event_name": "社團活動",
                "people_count": 25,
                "teacher_name": "王老師",
                "reason": "舉辦迎新活動"
            }
        } 
        #swagger.responses[200] = { 
            schema: 	
            {
                "message": "已取消",
                "request_id": 0
            }
        } 
    */
    controller.postBookings);
router.put('/:id/cancel', 
    /*
        #swagger.description = '取消申請'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '申請id',
            required: true,
            schema: "1"
        }
        #swagger.responses[200] = { 
            schema: 	
            {
                "message": "申請已建立",
                "request_id": 7
            }
        } 
    */
    controller.postCancelBookings);

module.exports = router;