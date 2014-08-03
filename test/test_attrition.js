

var attrition = require("attrition");

var stopWorkers = attrition.start(col, filter, worker, pollTime, lockTime);

attrition.send(col, task, callback);

attrition.healthCheck(col, callback);


