var safe = {w : 1};

exports.queue = function(collection, task, callback) {
    if(!callback) callback = function(){};
    collection.insert(task, safe, function(err, res) {
        callback(err, res);
    });
};

exports.start = function(collection, match, worker, pollTime, lockTime, log) {
    if(!collection || !match || !worker) throw new Error("missing argument");
    if(!pollTime) pollTime = 1000; //Poll every 1 second.
    if(!lockTime) lockTime = 900000; //Lock lasts 15 minutes.
    if(!log) log = console.log;

    //processing closure
    function processTasks(callback) {
        // find tasks that are not currently locked
        var now = Date.now();
        var query = {
            $and : [
                {$or : [
                    {'attrition.locked' : null},
                    {'attrition.locked' : {$lt : now-lockTime}}]},
                {'attrition.last' : {$ne : now}},
                {'attrition.blocked' : null}
            ]
        };
        if(match) query.$and.push(match);
        function find() {
            // lock a task for processing.
            collection.findAndModify(
                query, {}, {$set: {'attrition.locked': now}}, safe,
                function (err, task) {
                    // check we didn't get an error from the query.
                    if (err) { log(msg); return callback(new Error(msg)); }

                    // Handle getting no results (empty queue).
                    if (!task) return callback(null);

                    // Run the worker function.
                    try { worker(task, done, collection); } catch (err) { done(err); }

                    function done(err, keepTask, updates) {

                        if (err) {
                            log("error processing task: ",
                                JSON.stringify(task, null, 2),
                                err.stack);
                            // mark the task as blocked.
                            keepTask = true;
                            updates = {
                                $set : {
                                    'attrition.blocked' : true,
                                    'attrition.firstErrored' : now,
                                    'attrition.error': err.stack||err.toString()
                                },
                                $inc : {'attrition.errorCount' : 1}
                            };
                        }
                        if (keepTask) {
                            // completed: unlock and apply optional updates.
                            if(!updates) updates = {};
                            if(!updates.$set) updates.$set = {};
                            if(!updates.$set.attrition) updates.$set.attrition = {};
                            updates.$set.attrition.locked = null; // unlock the task.
                            // set last pass so we dont match again this pass
                            updates.$set.attrition.last = now; 
                            collection.update({_id : task._id}, updates, safe,
                                    function (err) {
                                        if (err) {
                                            log("Error unlocking task:",
                                                JSON.stringify(task,null,2),
                                                "with update",
                                                JSON.stringify(updates,null,2),
                                                err.toString());
                                        }
                                        // find the next task.
                                        process.nextTick(find);
                                    });
                        } else {
                            // completed: remove task from queue.
                            collection.remove({_id : task._id}, safe,
                                    function (err) {
                                        if (err) {
                                            log("error removing task:",
                                                JSON.stringify(task,null,2),
                                                err.toString());
                                        }
                                        // find the next task.
                                        process.nextTick(find);
                                    });
                        }
                    }
                });
        }
        find();

    }

    //Start polling queue
    var running = true;
    (function poll(err) {
        if(err) console.log('queue error', err);
        setTimeout(function() {if(running){processTasks(poll);}}, pollTime);
    })();

    //Return a function that can be used to stop the poll
    return function stop() { running = false; };
};

