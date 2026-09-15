const express = require('express');
const cors = require('cors');
const pool = require('./event_db');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname,'public')));

// GET /api/events/upcoming 首页即将开始活动
app.get('/api/events/upcoming', async (req,res)=>{
  try{
    const [rows] = await pool.query(`
      SELECT e.*, c.category_name, o.organisation_name
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organisations o ON e.organisation_id = o.organisation_id
      WHERE e.is_suspended = false AND e.event_date > NOW()
      ORDER BY e.event_date ASC
    `);
    res.json({success:true, data:rows});
  }catch(err){
    res.json({success:false, error:err.message});
  }
});

// GET /api/categories 获取全部分类
app.get('/api/categories', async (req,res)=>{
  try{
    const [rows] = await pool.query(`SELECT * FROM event_categories`);
    res.json({success:true, data:rows});
  }catch(err){
    res.json({success:false, error:err.message});
  }
});

// GET /api/events/search 搜索接口
app.get('/api/events/search', async (req,res)=>{
  try{
    const {categoryId, location, date} = req.query;
    let sql = `
      SELECT e.*, c.category_name, o.organisation_name
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organisations o ON e.organisation_id = o.organisation_id
      WHERE e.is_suspended = false
    `;
    const params = [];
    if(categoryId){
      sql += ` AND e.category_id = ?`;
      params.push(categoryId);
    }
    if(location){
      sql += ` AND e.location LIKE ?`;
      params.push(`%${location}%`);
    }
    if(date){
      sql += ` AND DATE(e.event_date) = ?`;
      params.push(date);
    }
    sql += ` ORDER BY e.event_date ASC`;
    const [rows] = await pool.query(sql, params);
    res.json({success:true, data:rows});
  }catch(err){
    res.json({success:false, error:err.message});
  }
});

// GET /api/events/:eventId 单个活动详情
app.get('/api/events/:eventId', async (req,res)=>{
  try{
    const eventId = req.params.eventId;
    const [rows] = await pool.query(`
      SELECT e.*, c.category_name, o.organisation_name, o.mission, o.contact_email
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organisations o ON e.organisation_id = o.organisation_id
      WHERE e.event_id = ?
    `,[eventId]);
    if(rows.length === 0){
      return res.json({success:false, msg:"Event not found"});
    }
    res.json({success:true, data:rows[0]});
  }catch(err){
    res.json({success:false, error:err.message});
  }
});


app.listen(PORT,()=>{
  console.log(`Server running on http://localhost:${PORT}`);
});
