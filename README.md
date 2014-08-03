# Attrition

Attrition is a simple queue system that uses a mongoDB collection to store jobs.

Here is a simple queue example that uses a state flag to pass a task between workers.

```javascript
var attrition = require("attrition");

var queue = mongoDB.collection('queue');

attrition.start(queue, {state : 'invoicing'}, sendInvoiceWorker);
attrition.start(queue, {state : 'shipping'}, shippingWorker);

function sendInvoiceWorker(task, collection, callback) {
    //Send an invoice
    ...
    // Now update the task to set it's state to 'shipping'
    collection.update({_id : task._id}, {$set : {state : 'shipping'}}, function(err, res) {
        callback(err, true); // pass true to keep the task in the queue. 
    });
}

function shippingWorker(task, collection, callback) {
    // Initiate shipping
    ...
    // finished with the task, pass false and it will be removed. 
    callback(err, false); 
}

//send a task to the queue
attrition.send(col, {state : 'invoicing', data : { ... }}, callback);

// get a healthcheck of the queue, number of tasks etc.
attrition.healthCheck(col, callback);


