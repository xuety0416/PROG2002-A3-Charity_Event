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

app.listen(PORT,()=>{
  console.log(`Server running on http://localhost:${PORT}`);
});
