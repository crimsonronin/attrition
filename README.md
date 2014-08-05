# Attrition

Attrition is a simple queue system that uses a mongoDB collection to store jobs.

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
attrition.send(queue, {state : 'invoicing', data : { shippingAddress : {...}}}, callback);

// get a healthcheck of the queue, number of tasks etc.
attrition.healthCheck(queue, callback);
```
