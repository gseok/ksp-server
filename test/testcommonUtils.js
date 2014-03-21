/**
 * Test util funtions
 */
var util = require('../routes/commonUtils');

describe('UTIL', function(){
	before(function(){
	});

	describe('cloneDoc', function() {
		it('should clone document', function(done) {
			done();
		});
	});

	describe('getPremission', function() {
		it('should return null', function(done) {
			var per = util.getPremission();
			(per == null).should.be.true;
			done();
		});

		it('should find permission', function(done) {
			done();
		});
	});
});
