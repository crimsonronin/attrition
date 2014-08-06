# Attrition

Attrition is a simple queue system that uses a mongoDB collection to store jobs.

Attrition handles task-locking between processes so you can run many instances of a
worker service, tasks are unlocked after a timeout (default 15 minutes). 

Tasks whos worker function raise an error remain in the queue and are blocked,
after which manual intervention is required.  The objective here is that no 
tasks should ever be lost.

## Why would I use this over a 'proper' *MQ service? 

Because you might not want to add another SPOF to your deployment. For us, Mongo, while clustered
is a critical failure point, if mongo is not accessible then no service is available. Adding an MQ
system introduces another critical failure point that needs to be managed, MongoDB is quite capable
of managing a queue of tasks.

## TODOs

 * Write more unit tests
 * Implement healthCheck

## Contrived Example:

Here is a simple queue example that uses a state flag to pass a task between workers.

```javascript
var attrition = require("attrition");

var queue = mongoDB.collection('queue');

// Start polling the queue and match tasks with state == 'invoicing'
attrition.start(queue, {state : 'invoicing'}, sendInvoiceWorker);

// Start polling the queue and match tasks with state == 'shipping'
attrition.start(queue, {state : 'shipping'}, shippingWorker);

function sendInvoiceWorker(task, callback) {
    //Send an invoice logic..

    // Now update the task to set it's state to 'shipping' by passing some
    // updates and passing true to keep the task in the queue. 
        callback(err, true, {$set : {state : 'shipping'}}); // pass true to keep the task in the queue. 
    });
}

function shippingWorker(task, callback) {
    // Initiate shipping logic..

    // finished with the task, pass false and it will be removed from the queue. 
    callback(err, false); 
}

//send a task to the queue
attrition.queue(queue, {state : 'invoicing', data : { shippingAddress : {...}}}, callback);

```
