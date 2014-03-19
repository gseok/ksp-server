var http = require('http');

describe('API', function(){
	before(function(){
	});

	describe('/renameDocument', function() {
		it('should response', function(done) {
			var options = {
				hostname: 'localhost',
			  	port: 3000,
			  	path: '/renameDocument',
			  	method: 'POST',
				headers: {
        				'Content-Type': 'application/json'
    				}
			};

			var req = http.request(options, function(res) {
				res.statusCode.should.equal(200);
				res.on('data', function (data) {
					var d = JSON.parse(data);

					d.should.be.an.instanceOf(Object).and.have.property('sm');
					d.should.be.an.instanceOf(Object).and.have.property('sc');
					d.sc.should.equal(0);
					d.sm.should.equal('Successfully title changing');

					done();
				});
			});

			req.on('error', function(e) {
				console.log('problem with request: ' + e.message);
				done();
			});

			// write data to request body
			var input = {em:"jugwan@webida.org",
						u:"webida/jugwan",
						db:"test", 
						l:"enUS", 
						t:"Title Changing"};
			req.write(JSON.stringify(input));
			req.end();
		});
	});
});

