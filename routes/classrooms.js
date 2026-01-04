const express = require('express');
const router = express.Router();
const controller = require('../controllers/classroomsController');

router.get(
  '/',
  /*  
        #swagger.description = '取得所有教室' 
        #swagger.responses[200] = { 
        schema: [
            {
                "classroom_id": "C101",
                "name": "第一演奏廳",
                "type": "音樂教室",
                "capacity": 120,
                "description": "有鋼琴與舞台",
                "image_url": "/images/C101.jpg",
                "created_at": "2025-11-29T16:27:57.000Z"
            },
            {
                "classroom_id": "C102",
                "name": "第二教室",
                "type": "一般教室",
                "capacity": 40,
                "description": "投影、白板",
                "image_url": "/images/C102.jpg",
                "created_at": "2025-11-29T16:27:57.000Z"
            }
        ]} 
    */
  controller.getAllClassrooms
);
router.get(
  '/:id',
  /*  
        #swagger.description = '取得特定教室'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '教室編號',
            required: true,
            schema: "C101"
        }   
        #swagger.responses[200] = { 
        schema: [
            {
                "classroom_id": "C101",
                "name": "第一演奏廳",
                "type": "音樂教室",
                "capacity": 120,
                "description": "有鋼琴與舞台",
                "image_url": "/images/C101.jpg",
                "created_at": "2025-11-29T16:27:57.000Z"
            } 
        ]} 
    */
  controller.getClassroomsById
);
router.post(
  '/',
  /* 
        #swagger.description = '新增教室 *只有管理員可以新增'
        #swagger.parameters['body'] = {
            in: 'body',
            description: '新增教室內容',
            required: true,
            schema: {
                "role": "admin",
                "classroom_id": "testclass",
                "name": "測試教室",
                "type": "一般教室",
                "capacity": 1000,
                "description": "新增描述",
                "image_url": "/url"
            }
        } 
        #swagger.responses[200] = { 
            schema: 	
            {
                "message": "已新增教室"
            }
        } 
    */

  controller.postClassrooms
);
router.put(
  '/:id',
  /* 
        #swagger.description = '新增特定教室 *只有管理員可以更新'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '教室id',
            required: true,
            schema: "C101"
        }  
        #swagger.parameters['body'] = {
            in: 'body',
            description: '更新教室內容',
            required: true,
            schema: {
                "name": "測試教室2",
                "type": "二般教室",
                "capacity": 9999,
                "description": "更新描述",
                "image_url": "/url2"
            }
        } 
        #swagger.responses[200] = { 
            schema: 	
            {
                "message": "教室資訊更新"
            }
        } 
    */
  controller.updateClassrooms
);
router.delete(
  '/:id',
  /*  
        #swagger.description = '刪除特定教室 *只有管理員可以刪除'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '教室id',
            required: true,
            schema: "C101"
        }   
        #swagger.responses[200] = { 
        schema: [
            {
                "message": "教室已刪除"
            }
        ]} 
    */
  controller.deleteClassrooms
);

module.exports = router;
