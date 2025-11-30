const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcementsController');

router.get('/', 
    /*  
        #swagger.description = '取得所有公告'
        #swagger.responses[200] = { 
        schema: [
            {
                "announcement_id": 3,
                "title": "器材維修",
                "content": "C101 舞台燈光將於 2025-11-10 進行維修，當日部分功能會停用。",
                "created_at": "2025-11-29T16:27:57.000Z",
                "expired_at": "2025-11-11T00:00:00.000Z"
            },
            {
                "announcement_id": 2,
                "title": "防疫注意事項",
                "content": "進入教室請配戴口罩並完成手部消毒。",
                "created_at": "2025-11-29T16:27:57.000Z",
                "expired_at": null
            }
        ]} 
    */
    controller.getAllAnnouncements);
router.get('/:id', 
    /*  
        #swagger.description = '取得特定公告'
        #swagger.parameters['id'] = {
            in: 'path',
            description: '公告id',
            required: true,
            schema: 2
        }   
        #swagger.responses[200] = { 
        schema: [
            {
                "announcement_id": 2,
                "title": "防疫注意事項",
                "content": "進入教室請配戴口罩並完成手部消毒。",
                "created_at": "2025-11-29T16:27:57.000Z",
                "expired_at": null
            }
        ]} 
    */
    controller.getAnnouncementsByid);

module.exports = router;