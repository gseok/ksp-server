
/**
 * Collect util functions
 *
 * - cloneDoc
 * - getCollectionWithParam
 * - getPremission
 */

// Return Code
var RETURN_CODE = {
    SUCCESS: 0,
    UNKNOWN_ERR: 1,
    INVALID_PARAM: 2,
    CANNOT_FIND_DOC: 3,
    DOCUMENT_URL_ALREADY_EXIST: 4,
    CANNOT_FIND_REVISION: 5,
    USER_ALREADY_EXIST: 6,
    CANNOT_FIND_USER: 7,
    CANNOT_FIND_USER_ROLE_MAP: 8,
    CANNOT_FIND_PERMISSIONS: 9
};

// Return Message
var RETURN_MESSAGE = {
    0: 'Success',
    1: 'Unknown error has occurred',
    2: 'Invalid parameter',
    3: 'Cannot find a document',
    4: 'Document url already exist',
    5: 'Cannot find a revision',
    6: 'User already exist',
    7: 'Cannot find a user',
    8: 'Cannot find user role map',
    9: 'Cannot find permissions'
};

function sendReturnCode(res, returnCode, returnMessage) {
    if (!returnMessage) {
        returnMessage = RETURN_MESSAGE[returnCode];
    }
    console.log(returnMessage);
    res.send({
        sc: returnCode,
        sm: returnMessage
    })
}

function cloneDoc(doc) {
    var clone = JSON.parse(JSON.stringify(doc));
    var tobeDeleted = clone._id;
    delete clone._id;
    return clone;
}

function getCollectionWithParam(collectionName, param, cb) {
    db.collection(collectionName, function(err, collection) {
        if (err) {
            sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
            return;
        } else {
            cb(null, collection, param);
        }
    });
}


/**
 * 
 * Validate e-mail address
 * 
 * @param {String} email - email address
 *
 * See http://rosskendall.com/blog/web/javascript-function-to-check-an-email-address-conforms-to-rfc822
 */
function isEmail(email) {
	return /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/.test( email );
}

/**
 * Get name using e-mail address
 * 
 * @param {String} email = email address
 */
function getEmailToName(email) {
	if (!email) {
		return null;
	}
	return email.substring(0, email.lastIndexOf("@"));
}

/**
 * Get permission in role
 * 
 * @param {Number} userID - user id, required
 * @param {mongo.Db} db - target db, required
 * @param {funcion} callback - callback function, required
 *                       - callback(permType), error then permType is null
 *
 * @author Gyeongseok.Seo <gseok.seo@webida.org>
 * @since: 2014.03.21
 */
function getPremission(userID, callback) {
	if (!userID) {
		if(callback) {
			callback.call(callback, null);
		}
		return;
	}

	async.waterfall([
        function(cb) {
            // get user_role_map collection
            var param = {
                adminID: userID
            };

            getCollectionWithParam('user_role_map', param, cb);
        },
        function(collection, param, cb) {
            var query = {
                userID: param.adminID.toString()
            };

            // find roles id
            collection.find(query).toArray(function(err, docs) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    if (!docs || docs.length < 1) {
                        // not exist
                        sendReturnCode(res, RETURN_CODE.CANNOT_FIND_USER_ROLE_MAP);
                        return;
                    } else {
                        // exist
                        // get roleIDs
                        param.roleIDs = [];
                        for (var i = 0; i < docs.length; i++) {
                            if(docs[i].roleID) {
                                param.roleIDs.push(docs[i].roleID);
                            }
                        }
                        getCollectionWithParam('permissions', param, cb);
                    }
                }    
            });
        },
        function(collection, param, cb) {
            var query = {
                $or: []
            };

            for (var i = 0; i < param.roleIDs.length; i++) {
                if(param.roleIDs[i]) {
                    query.$or.push({roleID: param.roleIDs[i]});
                }
            }

            // get perm type
            collection.find(query).toArray(function(err, docs) {
                if (!docs || docs.length < 1) {
                    // not exist
                    sendReturnCode(res, RETURN_CODE.CANNOT_FIND_PERMISSIONS);
                    return;
                } else {
                    var permType = [];

                    // get permissions
                    for (var i = 0; i < docs.length; i++) {
                        if(docs[i].permType) {
                            permType.push(docs[i].permType);
                        }
                    }

                    // check permissions
                    if( 100 in permType) {  // mockup if '100' is create user permissions
                    	console.log('djlsdfjklsdjflk');
                        cb(permType);
                    }

                    console.log(permType);
                    callback.call(callback, permType);
                }
            });
        },
	]);
}

var utils = {
	cloneDoc: cloneDoc,
	getCollectionWithParam: getCollectionWithParam,
	getPremission: getPremission,
	isEmail: isEmail,
	getEmailToName: getEmailToName
}

module.exports = utils;
