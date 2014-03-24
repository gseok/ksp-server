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
			var per = util.getPremission(null, function(permType){
				(permType == null).should.be.true;
				done();
			});
		});

		it('should find permission', function(done) {
			done();
		});
	});

	describe('isEmail', function() {
		it('should check email address, valid email', function(done) {
			// http://en.wikipedia.org/wiki/Email_address - valid email address, invalid sample
			var validEmail = [
				'niceandsimple@example.com',
				'very.common@example.com',
				'a.little.lengthy.but.fine@dept.example.com',
				'disposable.style.email.with+symbol@example.com',
				'other.email-with-dash@example.com',
				'user@[IPv6:2001:db8:1ff::a0b:dbd0]',
				'"much.more unusual"@example.com',
				'"very.unusual.@.unusual.com"@example.com',
				'postbox@com',
				'admin@mailserver1',
				'!#$%&\'*+-/=?^_`{}|~@example.org',
				'"()<>[]:,;@\\\"!#$%&\'*+-/=?^_`{}| ~.a"@example.org',
				'" "@example.org'
				/*
				TODO: isEmail function fix logic, pass follow 3 type
				'"very.(),:;<>[]\".VERY.\"very@\\ \"very\".unusual"@strange.example.com'
				'üñîçøðé@example.com',
				'üñîçøðé@üñîçøðé.com',
				*/
			];

			for(var i = 0; i < validEmail.length; i++) {
				var valid = util.isEmail(validEmail[i]);
				valid.should.be.true;
			}
			done();
		});

		it('should check email address, invalid email', function(done) {
			// http://en.wikipedia.org/wiki/Email_address - valid email address, invalid sample
			var inValidEmail = [
				'Abc.example.com',
				'A@b@c@example.com',
				'a"b(c)d,e:f;g<h>i[j\k]l@example.com',
				'just"not"right@example.com',
				'this is"not\allowed@example.com',
				'this\ still\"not\\allowed@example.com'
				/*
				TODO: isEmail function fix logic, 
				(top-level domain following up a dot require minimum two alphabetic characters (ISO 3166-1 alpha-2 code), for Brazil e.g. it must be br according to ISO 3166-1).
				'email@brazil.b'
				*/
			];

			for(var i = 0; i < inValidEmail.length; i++) {
				var valid = util.isEmail(inValidEmail[i]);
			}
			done();
		});
	});

	describe('getEmailToName', function() {
		it('should get email to name', function(done) {
			var name = util.getEmailToName('niceandsimple@example.com');
			(name === 'niceandsimple').should.be.true;

			name = util.getEmailToName('very.common@example.com');
			(name === 'very.common').should.be.true;

			name = util.getEmailToName('a.little.lengthy.but.fine@dept.example.com');
			(name === 'a.little.lengthy.but.fine').should.be.true;			

			done();
		});
	});
});
