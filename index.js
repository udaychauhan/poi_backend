const express = require('express')
const cors = require('cors')
const pg = require('pg')
const Redis = require('ioredis');
const redisClient = new Redis(process.env.REDIS_URL);
const getRateLimitHandler = require('./rateLimitHandler.js');
const rateLimitHandler = getRateLimitHandler(redisClient);


const app = express()
// configs come from standard PostgreSQL env vars
// https://www.postgresql.org/docs/9.6/static/libpq-envars.html
const pool = new pg.Pool()

const queryHandler = (req, res, next) => {
  pool.query(req.sqlQuery).then((r) => {
    return res.json(r.rows || [])
  }).catch(next)
}

app.use(cors())

app.use(rateLimitHandler);

app.get('/', (req, res) => {
  res.send('Welcome to EQ Works 😎')
})

app.get('/events/hourly', (req, res, next) => {
  req.sqlQuery = `
    SELECT date, hour, events
    FROM public.hourly_events
    ORDER BY date, hour
    LIMIT 168;
  `
  return next()
}, queryHandler)

app.get('/events/daily', (req, res, next) => {
  req.sqlQuery = `
    SELECT date, SUM(events) AS events
    FROM public.hourly_events
    GROUP BY date
    ORDER BY date
    LIMIT 7;
  `
  return next()
}, queryHandler)

app.get('/stats/hourly', (req, res, next) => {
  let {poiId, date} = req.query;
   req.sqlQuery = `
    SELECT *
    FROM public.hourly_stats as hourlyStats
    LEFT JOIN public.poi as poi
    ON hourlyStats.poi_id = poi.poi_id
    ORDER BY date, hour
    LIMIT 168;
  `
  if(poiId && date){
    poiId = parseInt(poiId);
     req.sqlQuery = `
      SELECT *
      FROM public.hourly_stats as hourlyStats
      LEFT JOIN public.poi as poi
      ON hourlyStats.poi_id = poi.poi_id
      WHERE hourlyStats.date = '${date}' AND poi.poi_id = ${poiId}
      ORDER BY date, hour
      LIMIT 168;
    `
  }
 
  return next()
}, queryHandler)

app.get('/stats/daily', (req, res, next) => {
  req.sqlQuery = `
    SELECT date,
        SUM(impressions) AS impressions,
        SUM(clicks) AS clicks,
        SUM(revenue) AS revenue
    FROM public.hourly_stats
    GROUP BY date
    ORDER BY date
    LIMIT 7;
  `
  return next()
}, queryHandler)

app.get('/poi', (req, res, next) => {
  req.sqlQuery = `
    SELECT *
    FROM public.poi;
  `
  return next()
}, queryHandler)

app.listen(process.env.PORT || 5555, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  } else {
    console.log(`Running on ${process.env.PORT || 5555}`)
  }
})

// last resorts
process.on('uncaughtException', (err) => {
  console.log(`Caught exception: ${err}`)
  process.exit(1)
})
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
  process.exit(1)
})
