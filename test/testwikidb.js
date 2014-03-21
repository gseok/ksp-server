var http = require('http');

describe('API', function(){
	var options = {};

	before(function(){
		options.hostname = 'localhost';
	  	options.port = 3000;
	  	options.method = 'POST';
		options.headers = {
			'Content-Type': 'application/json'
		};
	});

	describe('/renameDocument', function() {
		it('should response', function(done) {
			options.path = '/renameDocument';

			var req = http.request(options, function(res) {
				res.statusCode.should.equal(200);
				res.on('data', function (data) {
					var d = JSON.parse(data);
					console.log(d);

					d.should.be.an.instanceOf(Object).and.have.property('sm');
					d.should.be.an.instanceOf(Object).and.have.property('sc');
					d.sc.should.equal(0);
					d.sm.should.equal('Successfully saved');

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

	describe('/addUser', function() {
		it('should Successfully response', function(done) {
			options.path = '/addUser';

			var req = http.request(options, function(res) {
				res.statusCode.should.equal(200);
				res.on('data', function (data) {
					var d = JSON.parse(data);
					console.log(d);

					d.should.be.an.instanceOf(Object).and.have.property('sm');
					d.should.be.an.instanceOf(Object).and.have.property('sc');
					d.sc.should.equal(0);
					d.sm.should.equal('Successfully add new user');

					done();
				});
			});

			req.on('error', function(e) {
				console.log('problem with request: ' + e.message);
				done();
			});

			// write data to request body
			var input = {em:"jugwan@webida.org",
						v:"gseok.seo@webida.org"};
			req.write(JSON.stringify(input));
			req.end();			
		});
	});
});

