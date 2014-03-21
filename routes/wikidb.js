// db and library setting
var mongo = require('mongodb');
var async = require('async');
var Server = mongo.Server,
Db = mongo.Db,
BSON = mongo.BSONPure;
var server = new Server('172.21.101.80', 27017, {auto_reconnect: true});
db = new Db('wikidb', server);
db.open(function(err, db) {
    if (!err) {
        console.log('Connected to \'wikidb\' database');
    }
});

// Return Code
var RETURN_CODE = {
    SUCCESS: 0,
    UNKNOWN_ERR: 1,
    INVALID_PARAM: 2,
    CANNOT_FIND_DOC: 3,
    DOCUMENT_URL_ALREADY_EXIST: 4,
    CANNOT_FIND_REVISION: 5,
    USER_ALREADY_EXIST: 6,
    CANNOT_FIND_USER: 7
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
    7: 'Cannot find a user'
};

// Document type
var DOC_TYPE = {
    DOCUMENT: 0,
    FILE_STORAGE: 1,
    BOOKMARK: 2
};

// Save type
var SAVE_TYPE = {
    RENAME: 0,
    SAVE: 1
}

function sendReturnCode(res, returnCode, returnMessage) {
    if (!returnMessage) {
        returnMessage = RETURN_MESSAGE.returnCode;
    }
    res.send({
        sc: returnCode,
        sm: returnMessage
    })
}

function getCollection(collectionName, cb) {
    db.collection(collectionName, function(err, collection) {
        if (err) {
            sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
            return;
        } else {
            cb(null, collection);
        }
    });
}

// checker : Array of string
// checkee : Object
function validateInputParams(checker, checkee) {
    for (var i = 0; i < checker.length; i++) {
        if (!(checker[i] in checkee)) {
            return false;
        }
    }
    return true;
}

function cloneDoc(doc) {
    var clone = JSON.parse(JSON.stringify(doc));
    var tobeDeleted = clone._id;
    delete clone._id;
    return clone;
}

function saveDoc(input, type, res) {
    async.waterfall([
        function(cb) {
            getCollection('doc_revisions', cb);
        },
        function(revisions, cb) {
            revisions.findOne({url: input.u, docBase: input.db, locale: input.l.toLowerCase(), deletedDate: '', latest: true}, function(err, oldRevision) {
                if (oldRevision) {
                    newRevision = cloneDoc(oldRevision);
                    newRevision.latest = true;
                    var now = new Date();
                    newRevision.createdDate = now.toUTCString();
                    newRevision.authorName = input.em.substring(0, input.em.indexOf('@'));
                    var newVersion = Number(newRevision.version) + 1;
                    newRevision.version = String(newVersion);
                    if (type === SAVE_TYPE.SAVE) {
                        newRevision.title = input.t;
                        newRevision.content = input.c;
                        newRevision.fileIds = input.is;
                    } else if (type === SAVE_TYPE.RENAME) {
                        newRevision.title = input.t;
                    }
                    cb(null, revisions, oldRevision);
                } else {
                    sendReturnCode(RETURN_CODE.CANNOT_FIND_DOC);
                    return;
                }
            });
        },
        function(revisions, oldRevision, cb) {
            revisions.update({ _id: oldRevision._id }, { $set: { latest : false } });
            revisions.insert(newRevision, {}, function(err, result) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    sendReturnCode(res, RETURN_CODE.SUCCESS);
                    return;
                }
            });
        }
    ]);
};

// tree algorithm : http://www.sitepoint.com/hierarchical-data-database
exports.getDocumentTree = function(req, res) {
    console.log('getDocumentTree', req.body);
    var input = req.body;
    var docBase, locale, depth, url;
    var results = [];
    var totalResults = 0;
    var processedResults = 0;
    if (validateInputParams(['em', 'db', 'u', 'l', 'd'], input)) {
        // TODO : user validation
        docBase = input.db;
        url = input.u;
        locale = input.l.toLowerCase();
        depth = Number(input.d) - 1;
        if (depth < 1) {
            sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
            return;
        }
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }
    async.waterfall([
        function(cb) {
            getCollection('docs', cb);
        },
        function(docs, cb) {
            docs.findOne({url: url, docBase: docBase, deletedDate: ''}, function(err, item) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    if (item) {
                        cb(null, docs, item);
                    } else {
                        sendReturnCode(res, RETURN_CODE.CANNOT_FIND_DOC);
                        return;
                    }
                }
            });
        },
        function(docs, item, cb) {
            var leftLimit = Number(item.left) + Number(depth);
            docs.find({
                '$or' : [
                    {
                        left: { '$gte': item.left, '$lte': leftLimit }
                    },
                    {
                        right: { '$lte': item.right }
                    }
                ],
                deletedDate: ''
            }).toArray(function (err, items) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    cb(null, items);
                }
            });
        },
        function(items, cb) {
             db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    cb(null, revisions, items);
                }
            });
        },
        function(revisions, items, cb) {
            totalResults = items.length;
            items.forEach(function(doc) {
                revisions.findOne({url: doc.url, docBase: docBase, locale: locale, latest: true, deletedDate: ''}, function(err, revision) {
                    if (err) {
                        sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                        return;
                    } else {
                        if (revision) {
                            cb(null, doc, revision);
                        }
                    }                
                });
            });
        },
        function(doc, revision) {
            var result = {};
                result.t = revision.title;
                result.u = doc.url;
                result.tp = doc.docType;
                result.pu = doc.parentDocumentUrl;
                result.up = { // TODO with permissions
                    v: true,
                    m: true,
                    a: true,
                    d: true,
                    ad: true,
                };
                result.c = doc.hasChild;
                results.push(result);
            processedResults++;
            if (processedResults === totalResults) {
                res.send({
                    sc: RETURN_CODE.SUCCESS,
                    sm: 'Successfully get documents',
                    uds: [],
                    dds: results
                });
                return;
            }
        }
    ]);
};

exports.saveDocument = function(req, res) {
    console.log('saveDocument', req.body);
    var input = req.body;
    var newRevision, url, locale, version, docBase;
    if (validateInputParams(['em', 'db', 'u', 'l', 't', 'c', 'is'], input)) {
        // TODO : user validation
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }

    // save document
    saveDoc(input, SAVE_TYPE.SAVE, res);
};

/**
 * Changing document title
 * 
 * @param req.body -
         {
            em : string - user email
            db : string - document base
            u : string - document url
            l : string - locale
            t : string - document title
         }
 * @param res -
         {
            sc : number - status code
            sm : string - status message
         }

 * @author Gyeongseok.Seo <gseok.seo@webida.org>
 * @since: 2014.03.18
 */
exports.renameDocument = function(req, res) {
    console.log('renameDocument : ', req.body);
    var input = req.body;

    // check request param
    if (validateInputParams(['em', 'db', 'u', 'l', 't'], input)) {
        // TODO : user validation
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }

    // rename document
    saveDoc(input, SAVE_TYPE.RENAME, res);
}

exports.getDocument = function(req, res) {
    console.log('getDocument : ', req.body);
    var email, url, docBase, version, locale;
    var breadcrumbDocumentUrls = [];
    var breadcrumbDocumentTitles = [];
    var totalBreadcrumb = 0;
    var currentBreadcrumb = 0;
    var input = req.body;
    if (validateInputParams(['em', 'db', 'u', 'l', 'v'], input)) {
        // TODO : user validation
        email = input.em;
        url = input.u;
        docBase = input.db;
        version = String(input.v);
        locale = input.l.toLowerCase();
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }
    async.waterfall([
        function(cb) {
            getCollection('docs', cb);
        },
        function(docs, cb) {
            docs.findOne({url:url, docBase:docBase, deletedDate: ''}, function(err, doc) {
                if (doc) {
                    cb(null, docs, doc);
                } else {
                    sendReturnCode(res, RETURN_CODE.CANNOT_FIND_DOC);
                    return;
                }
            });
        },
        function(docs, doc, cb) {
            docs.find({left: {'$lte': doc.left}, right: {'$gte':doc.right}, deletedDate: ''}).toArray(function (err, items) {
                for (var i = 0; i < items.length; i++) {
                    breadcrumbDocumentUrls.push(items[i].url);
                }
                breadcrumbDocumentUrls.sort(function(a, b) {
                    return a.left - b.left;
                });
                cb(null, items);
            });
        },
        function(items, cb) {
            db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    cb(null, revisions, items);
                }
            });
        },
        function(revisions, items, cb) {
            totalBreadcrumb = items.length;
            for (var i = 0; i < items.length; i++) {
                revisions.findOne({url: items[i].url, docBase: items[i].docBase, version: version, deletedDate: ''}, function(err, rev) {
                    if (err) {
                        sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                        return;
                    } else {
                        if (!rev) {
                            sendReturnCode(res, RETURN_CODE.CANNOT_FIND_REVISION);
                            return;
                        }
                        breadcrumbDocumentTitles.push(rev.title);
                        currentBreadcrumb++;
                        if (currentBreadcrumb === totalBreadcrumb) {
                            breadcrumbDocumentTitles.sort(function(a, b) {
                                return a.left - b.left;
                            });
                            cb(null, revisions);
                        }
                    }
                });
            }
        },
        function(revisions, cb) {
            revisions.findOne({url: url, docBase: docBase, locale:locale, version:version, deletedDate: ''}, function(err, revision) {
                if (revision) {
                    cb(null, revision);
                } else {
                    sendReturnCode(res, RETURN_CODE.CANNOT_FIND_REVISION);
                    return;
                }
            });
        },
        function(revision, cb) {
            res.send({
                sc: RETURN_CODE.SUCCESS,
                sm: 'Successfully get document',
                t: revision.title,
                c: revision.content,
                v: revision.version,
                md: revision.createdDate,
                mun: revision.authorName,
                mui: revision.authorId,
                bu: breadcrumbDocumentUrls,
                bt: breadcrumbDocumentTitles
            });
            return;
        }
    ]);
}

exports.createDocument = function(req, res) {
    console.log('Create Document : ', req.body);
    var input = req.body;
    var newDoc = {};
    var newRevision = {};
    if (validateInputParams(['em', 'db', 'u', 'l', 't', 'pu'], input)) {    
        // TODO : user validation
        newDoc.docBase = input.db;
        newDoc.docType = DOC_TYPE.DOCUMENT;
        newDoc.url = input.u;
        newDoc.authorName = input.em.substring(0, input.em.indexOf('@')); // TODO
        newDoc.authorId = 'todo'; // TODO
        newDoc.parentDocumentUrl = input.pu;
        newDoc.hasChild = false;
        var now = new Date();
        newDoc.createdDate = now.toUTCString();
        newDoc.deletedDate = '';
        newDoc.fileIds = [];

        newRevision.url = input.u;
        newRevision.docBase = input.db;
        newRevision.authorId = 'todo'; // TODO
        newRevision.title = input.t;
        newRevision.content = 'just created';
        newRevision.locale = input.l.toLowerCase();
        newRevision.version = String(1);
        newRevision.latest = true;
        newRevision.createdDate = now.toUTCString();
        newRevision.deletedDate = '';
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }    
    async.waterfall([
        function(cb) {
            getCollection('docs', cb);
        },
        function(docs, cb) {
            db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    cb(null, docs, revisions);
                }
            });
        },
        function(docs, revisions, cb) {
            docs.findOne({url: newDoc.url, docBase: newDoc.docBase, deletedDate: ''}, function(err, item) {
                if (!item) {
                    cb(null, docs, revisions);
                } else {
                    sendReturnCode(res, RETURN_CODE.DOCUMENT_URL_ALREADY_EXIST);
                    return;
                }
            });
        },
        function(docs, revisions, cb) {
            docs.findOne({url: newDoc.parentDocumentUrl, docBase: newDoc.docBase, deletedDate: ''}, function(err, parent) {
                if (parent) {
                    // make room to insert
                    docs.find({right:{'$gte' : parent.right}}).toArray(function (err, items) {
                        items.forEach(function (elem) {
                            docs.update({ _id : elem._id }, { $set: {right : elem.right + 2} });
                        });
                    });
                    docs.find({left:{'$gte' : parent.right}}).toArray(function (err, items) {
                        items.forEach(function (elem) {
                            docs.update({ _id : elem._id }, { $set: {right : elem.right + 2} });
                        });
                    });
                    newDoc.left = parent.right;
                    newDoc.right = parent.right + 1;
                    // mark hasChild of parent document
                    docs.update({ url: newDoc.parentDocumentUrl }, { $set: { hasChild: true } });
                } else {
                    newDoc.left = 1;
                    newDoc.right = 2;
                }
                cb(null, docs, revisions);
            });
        },
        function(docs, revisions, cb) {
            docs.insert(newDoc, {}, function(err, resultDoc) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    cb(null, revisions, resultDoc);
                }
            });
        },
        function(revisions, resultDoc, cb) {
            revisions.insert(newRevision, {}, function (err, resultRevision) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    res.send({
                        sc:RETURN_CODE.SUCCESS,
                        sm: 'Successfully created',
                        u: resultRevision[0].url,
                        t: resultRevision[0].title,
                        pu: resultDoc[0].parentDocumentUrl
                    });
                    return;
                }
            })
        }
    ]);
}

exports.checkDocumentUrl = function(req, res) {
    console.log('checkDocumentUrl : ', req.body);
    var email, url, docBase;
    var input = req.body;
    if (validateInputParams(['em', 'db', 'u'], input)) {    
        // TODO : user validation
        email = input.em;
        url = input.u;
        docBase = input.db;
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }
    async.waterfall([
        function(cb) {
            getCollection('docs', cb);
        },
        function(collection, cb) {
            collection.findOne({url: url, docBase:docBase, deletedDate: ''}, function(err, doc) {
                if (doc) {
                    sendReturnCode(res, RETURN_CODE.DOCUMENT_URL_ALREADY_EXIST);
                    return;
                } else {
                    sendReturnCode(res, RETURN_CODE.SUCCESS);
                    return;
                }
            });
        }
    ]);
}

exports.deleteDocument = function(req, res) {
    console.log('deleteDocument : ', req.body);
    var email, url, docBase;
    var input = req.body;
    if (validateInputParams(['em', 'db', 'u'], input)) {    
        // TODO : user validation
        email = input.em;
        url = input.u;
        docBase = input.db;
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }
    async.waterfall([
        function(cb) {
            getCollection('docs', cb);
        },
        function(docs, cb) {
            db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    cb(null, docs, revisions);
                }
            });
        },
        function(docs, revisions, cb) {
            docs.findOne({url: url, docBase: docBase, deletedDate: ''}, function(err, doc) {
                if (doc) {
                    cb(null, docs, revisions, doc);
                } else {
                    sendReturnCode(res, RETURN_CODE.CANNOT_FIND_DOC);
                    return;
                }
            });
        },
        function(docs, revisions, doc, cb) {
            var now = new Date();
            var deletedDate = now.toUTCString();
            docs.find({left: {'$gte': doc.left}, right: {'$lte':doc.right}, deletedDate: ''}).toArray(function(err, items) {
                for (var i = 0; i < items.length; i++) {
                    docs.update({_id: items[i]._id},{$set: {deletedDate: deletedDate}});
                    revisions.update({url: items[i].url},{$set: {deletedDate: deletedDate}});
                }
                sendReturnCode(res, RETURN_CODE.SUCCESS);
                return;
            });
        },
    ]);
}

exports.getDocumentHistory = function(req, res) {
    console.log('getDocumentHistory : ', req.body);
    var email, url, docBase, locale, startPosition, length;
    var input = req.body;
    if (validateInputParams(['em', 'db', 'u', 'l', 'le', 's'], input)) {    
        // TODO : user validation
        email = input.em;
        url = input.u;
        docBase = input.db;
        locale = input.l.toLowerCase();
        startPosition = Number(input.s);
        length = Number(input.le);
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }
    async.waterfall([
        function(cb) {
            getCollection('doc_revisions', cb);
        },
        function(revisions, cb) {
            revisions.find({url: url, docBase: docBase, locale: locale}).toArray(function(err, revisions) {
                revisions.sort(function(a, b) {
                    return a.version - b.version;
                });

                if (revisions.length < startPosition) {
                    sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
                    return;
                } else {
                    var results = [];
                    for(var i = startPosition; i < revisions.length; i++) {
                        var result = {};
                        result.t = revisions[i].title;
                        result.v = revisions[i].version;
                        result.n = revisions[i].authorName;
                        result.m = revisions[i].createdDate;
                        results.push(result);
                    }
                    res.send({
                        sc: RETURN_CODE.SUCCESS,
                        sm: 'Successfully get document history',
                        vs: results
                    });
                    return;
                }
            });
        }
    ]);
}

/**
 * Add new user
 * 
 * @param req.body -
        {
            em : string - admin's email
            v : string - value - user email
        }
 * @param res -
         {
            sc : number - status code
            sm : string - status message
         }

 * @author Gyeongseok.Seo <gseok.seo@webida.org>
 * @since: 2014.03.21
 */
exports.addUser = function(req, res) {
    console.log('addUser : ',  req.body);
    var email, value;
    var input = req.body;

    // check requeset param
    if (validateInputParams(['em', 'v'], input)) {    
        email = input.em;
        value = input.v;
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }

    // add user
    async.waterfall([
        function(cb) {
            // get users collection
            getCollection('users', cb);
        },
        function(collection, cb) {
            // check admin user exist
            var query = {
                email: email
            };

            collection.find(query).toArray(function(err, docs) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    if (!docs || docs.length < 1) {
                        // not exist
                        sendReturnCode(res, RETURN_CODE.CANNOT_FIND_USER, '"' + email + '" user not exist');
                        return;
                    } else {
                        // exist
                        cb(null, collection);
                    }
                }
            });            
        },
        function(collection, cb) {
            // check admin user permissions
            // TODO: implement admin user permissions check logic
            cb(null, collection);
        },
        function(collection, cb) {
            // check already exist user
            var query = {
                email: value
            };

            collection.find(query).toArray(function(err, docs) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    if (docs && docs.length > 0) {
                        // already exist
                        sendReturnCode(res, RETURN_CODE.USER_ALREADY_EXIST, '"' + value + '" user already exist');
                        return;
                    } else {
                        // not exist
                        cb(null, collection);
                    }
                }
            });
        },
        function(collection, cb) {
            // add user
            var user = {};

            // create new user docuemnt
            // TODO: need to user 'name' and 'locale' assign logic
            user.email = value;
            user.name = '';
            user.locale = '';
            var now = new Date().toUTCString();
            user.createdDate = now;
            user.updatedDate = now;
            user.deletedDate = '';

            // add new user
            collection.insert(user, {}, function(err, result) {
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    sendReturnCode(res, RETURN_CODE.SUCCESS);
                    return;
                }
            });
        }
    ]); // close async.waterfall
}

exports.searchDocument = function(req, res) {
    console.log('searchDocument : ', req.body);
    var email, docBase, keyword, locale;
    var input = req.body;
    if (validateInputParams(['em', 'db', 'l', 'k'], input)) {    
        email = input.em;
        docBase = input.db;
        keyword = input.k;
        locale = input.l.toLowerCase();
    } else {
        sendReturnCode(res, RETURN_CODE.INVALID_PARAM);
        return;
    }
    function makeResponse(items){
        var docs = [];
        for(var i = 0; i < items.length; i++) {
            var doc = {};
            doc.u = items[i].url;
            doc.t = items[i].title;
            doc.c = items[i].content;
            docs.push(doc);
        }
        
        return docs;
    }
    async.waterfall([
        function(cb) {
            getCollection('docs', cb);
        },
        function(collection, cb) {
            if (!keyword) {
                collection.find().toArray(function(err, items){
                    var docs = makeResponse(items);
                    res.send({
                        items:items,
                        sc: RETURN_CODE.SUCCESS,
                        sm: 'Successfully get document history',
                        t: docs.length,
                        vs: docs
                    });
                    return;
                });
            } else {
                var splitKeyword = keyword.split(' ');
                var findArray = [];
                for(var i=0; i<splitKeyword.length; i++ ){
                    var key = splitKeyword[i];
                    var set = [];
                    
                    if(key) {
                        set.push({'content' :{$regex: key, $options:'x' }});
                        set.push({'title' :{$regex: key, $options:'x' }});
                        set.push({'url' :{$regex: key, $options:'x' }});
                        findArray.push({$or : set});
                    }
                }
                collection.find( {$and:findArray} ).toArray(function(err, items) {
                    if (err) {
                        sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                        return;
                    } else {
                        cb(null, collection, items, findArray);
                    }
                });
            }
        },
        function(collection, andItems, findArray, cb) {
            function isInArray(item, array2, a) {
                for(var i=0; i < array2.length; i++) {
                    if(item.url === array2[i].url && item.docBase === array2[i].docBase) {
                        return true;
                    }
                }
                return false;
            }
            function removeArrayDuplicate(array, array2) {
                var ret = [];
                for(var i=0; i <array.length; i++){
                    if (isInArray(array[i], array2, i) === false) {
                        ret.push(array[i]);
                    }
                }
                
                return ret;
            }
            
            collection.find( {$or:findArray}).toArray(function(err, orItems){
                if (err) {
                    sendReturnCode(res, RETURN_CODE.UNKNOWN_ERR);
                    return;
                } else {
                    var orItems2 = removeArrayDuplicate(orItems, andItems);
                    var items = andItems.concat(orItems2);
                    var docs = makeResponse(items);
                    res.send({
                        items:items,
                        sc: RETURN_CODE.SUCCESS,
                        sm: 'Successfully get document history',
                        t:docs.length,
                        vs: docs
                    });
                    return;
                }
            });
        }
    ]);
}