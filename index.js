
exports.start = function(collection, match, worker, pollTime, lockTime) {
    if(!collection || !match || |!worker) throw new Error("missing argument");
    if(!pollTime) pollTime = 5000; //Poll every 5 seconds.
    if(!lockTime) lockTime = 900000; //Lock lasts 15 minutes.

};

