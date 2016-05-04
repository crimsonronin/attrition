var safe = {
    w: 1
};

/**
 * @param collection
 * @param task
 * @param callback
 */
exports.queue = function(collection, task, callback) {
    callback = callback || function() {}; // eslint-disable-line no-param-reassign

    collection.insert(task, safe, function(err, res) {
        callback(err, res);
    });
};

/**
 * Start the attrition process.
 *
 * @param collection
 * @param match
 * @param worker
 * @param pollTime
 * @param lockTime
 * @param log
 * @returns {stop}
 */
exports.start = function(collection, match, worker, pollTime, lockTime, log) {
    var running;

    if (!collection || !match || !worker) {
        throw new Error('missing argument');
    }

    // Poll every 1 second.
    pollTime = pollTime || 1000; // eslint-disable-line no-param-reassign
    // Lock lasts 15 minutes.
    lockTime = lockTime || 900000; // eslint-disable-line no-param-reassign
    log = log || console.log; // eslint-disable-line

    // processing closure
    function processTasks(callback) {
        // find tasks that are not currently locked
        var now = Date.now();
        var query = {
            $and: [
                {
                    $or: [
                        {'attrition.locked': null},
                        {'attrition.locked': {$lt: now - lockTime}}
                    ]
                },
                {'attrition.last': {$ne: now}},
                {'attrition.blocked': null}
            ]
        };

        if (match) {
            query.$and.push(match);
        }

        function find() {
            // lock a task for processing.
            collection.findAndModify(
                query,
                {},
                {
                    $set: {
                        'attrition.locked': now
                    }
                },
                safe,
                function(findModifyErr, task) {
                    // check we didn't get an error from the query.
                    if (findModifyErr) {
                        log(findModifyErr);
                        return callback(new Error(findModifyErr));
                    }

                    // Handle getting no results (empty queue).
                    if (!task) {
                        return callback(null);
                    }

                    // Run the worker function.
                    try {
                        worker(task, done, collection); // eslint-disable-line
                    } catch (err) {
                        done(err);  // eslint-disable-line
                    }

                    function done(doneErr, keepTask, updates) {
                        if (doneErr) {
                            log(
                                'error processing task: ',
                                JSON.stringify(task, null, 2),
                                doneErr
                            );
                            // mark the task as blocked.
                            keepTask = true; // eslint-disable-line no-param-reassign
                            updates = { // eslint-disable-line no-param-reassign
                                $set: {
                                    'attrition.blocked': true,
                                    'attrition.firstErrored': now,
                                    'attrition.error': doneErr ? JSON.stringify(doneErr) : ''
                                },
                                $inc: {
                                    'attrition.errorCount': 1
                                }
                            };
                        }

                        if (keepTask) {
                            // completed: unlock and apply optional updates.
                            if (!updates) {
                                updates = {}; // eslint-disable-line no-param-reassign
                            }

                            if (!updates.$set) {
                                updates.$set = {};
                            }

                            updates.$set['attrition.locked'] = null; // unlock the task.
                            // set last pass so we dont match again this pass
                            updates.$set['attrition.last'] = now;

                            collection.update(
                                {_id: task._id},
                                updates,
                                safe,
                                function(updateErr) {
                                    if (updateErr) {
                                        log(
                                            'Error unlocking task:',
                                            JSON.stringify(task, null, 2),
                                            'with update',
                                            JSON.stringify(updates, null, 2),
                                            updateErr.toString()
                                        );
                                    }
                                    // find the next task.
                                    process.nextTick(find);
                                }
                            );
                        } else {
                            // completed: remove task from queue.
                            collection.remove(
                                {_id: task._id}, safe,
                                function(err) {
                                    if (err) {
                                        log(
                                            'error removing task:',
                                            JSON.stringify(task, null, 2),
                                            err.toString()
                                        );
                                    }
                                    // find the next task.
                                    process.nextTick(find);
                                }
                            );
                        }
                    }
                }
            );
        }

        find();
    }

    // Start polling queue
    running = true;
    (function poll(err) {
        if (err) {
            log('Queue error', err);
        }
        setTimeout(function() {
            if (running) {
                processTasks(poll);
            }
        }, pollTime);
    })();

    // Return a function that can be used to stop the poll
    return function stop() {
        running = false;
    };
};

