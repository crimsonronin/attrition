var assert    = require('assert');
var mongodb   = require('mongodb');
var attrition = require('../index');

describe("Attrition", function() {

    var db, queue;

    before(function(done){
        mongodb.MongoClient.connect('mongodb://localhost:27017/test_attrition',
            function(err, database) {
                if(err) throw err;
                db = database;
                queue = db.collection('test-queue');
                done();
            });
    });

    after(function(done){
            db.dropDatabase(done);
    });

    it("should process a task", function(done) {

        var stop = attrition.start(queue, {}, function(task, callback) {
            assert.equal(task.payload, 123);
            callback(null, false);
            done();
        });

        attrition.queue(queue, {payload : 123});
    });


});

