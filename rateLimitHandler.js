const moment = require("moment");
const ipHeaders = [ "x-forwarded-for" ];
const REQUEST_COUNTER = 10;
let redisClient;
// a better solution will be
// to add more headers in ip headers array, all in lowercase
// lowercase all request headers keys
// or finding a library which does all for us !

// also, if the access to the api is autheticated then we can just use user id for reference here
const getRequestIpAddress = request => {
    let requestIpAddress = null;
    const requestHeaders = request.headers;
    for(const headerName of ipHeaders){
        const headerValue = requestHeaders[headerName];
        if ( headerValue ) {
          requestIpAddress = headerValue.split(",")[0];
          break;  
        }
    }
    return requestIpAddress;
};

const getKey = ipAddr => `RATE_LIMIT_${ipAddr}`

const setRedisProp = async (reqIPAddr, requestTime, counter) => {
  await redisClient.set(getKey(reqIPAddr),JSON.stringify({requestTime, counter}))
}

const getRedisProp = async (reqIPAddr) => {
  const result = await redisClient.get(getKey(reqIPAddr));
  return JSON.parse(result);
}

const isRequestOverLimit = async (reqIPAddr) => {
  const requestInfo = await getRedisProp(reqIPAddr);
  if(!requestInfo) {
    await setRedisProp(reqIPAddr, moment().format(), 1);
    return false
  }
  let { requestTime, counter } = requestInfo;
  const timeDifferenceBetweenPreviousRequest = moment().diff(moment(requestTime).format(),"minutes");
  if(timeDifferenceBetweenPreviousRequest <= 1){
    if(counter > REQUEST_COUNTER ){
      return true
    }
    await setRedisProp(reqIPAddr, requestTime, ++counter);
    return false;
  }
  // only update request time after a minute
  await setRedisProp(reqIPAddr, moment().format(), 1);
  return false;
}

const getRateLimitHandler = (client) => {
  redisClient = client;
  return async (req, res, next) => {
    const reqIPAddr = getRequestIpAddress(req);
    try {
     const status = await isRequestOverLimit(reqIPAddr);
      if(status){
        return res.status(429).json({message : `Requests went over limit ${REQUEST_COUNTER}`})
      }
    }catch(e){
      console.log(e.toString())
    }
    return next();
  }
}

module.exports = getRateLimitHandler
