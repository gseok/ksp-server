
/**
 * Collect util functions
 *
 * - cloneDoc
 * - getPremission
 */

function cloneDoc(doc) {
    var clone = JSON.parse(JSON.stringify(doc));
    var tobeDeleted = clone._id;
    delete clone._id;
    return clone;
}

/**
 * Get permission in role
 * 
 * @param {Number} roleID - roles id, required
 * @param {mongo.Db} db - target db, required
 * @returns {Number} - if don't find permission then null,
 					else find permission then permission type num
 *
 * @author Gyeongseok.Seo <gseok.seo@webida.org>
 * @since: 2014.03.21
 */
function getPremission(roleID, db) {
	if (!roleID || !db) {
		return null;
	}
}

var utils = {
	cloneDoc: cloneDoc,
	getPremission: getPremission
}

module.exports = utils;
