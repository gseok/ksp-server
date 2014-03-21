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

function cloneDoc(doc) {
    var clone = JSON.parse(JSON.stringify(doc));
    var tobeDeleted = clone._id;
    delete clone._id;
    return clone;
}

function saveDoc(input, type, res) {
    async.waterfall([
        function(cb) {
            db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'});
                } else {
                    cb(null, revisions);
                }
            });
        },
        function(revisions, cb) {
            revisions.findOne({url: input.u, locale: input.l.toLowerCase(), deletedDate: '', latest: true}, function(err, oldRevision) {
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
                    res.send({
                        sc: RETURN_CODE.CANNOT_FIND_DOC,
                        sm: 'Cannot find a document'
                    });
                }
            });
        },
        function(revisions, oldRevision, cb) {
            revisions.update({ _id: oldRevision._id }, { $set: { latest : false } });
            revisions.insert(newRevision, {}, function(err, result) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    res.send({
                        sc: RETURN_CODE.SUCCESS,
                        sm: 'Successfully saved'
                    });
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
    if ('em' in input && 'db' in input && 'u' in input && 'l' in input && 'd' in input) {
        // TODO : user validation
        docBase = input.db;
        url = input.u;
        locale = input.l.toLowerCase();
        depth = Number(input.d) - 1;
        if (depth < 1) {
            res.send({
                sc: RETURN_CODE.INVALID_PARAM,
                sm: 'Invalid parameter'
            });
        }
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection('docs', function(err, docs) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, docs);
                }
            });
        },
        function(docs, cb) {
            docs.findOne({url: url, docBase: docBase, deletedDate: ''}, function(err, item) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    if (item) {
                        cb(null, docs, item);
                    } else {
                        res.send({
                            sc: RETURN_CODE.CANNOT_FIND_DOC,
                            sm: 'Cannot find a document'
                        });
                    }
                }
            });
        },
        function(docs, item, cb) {
            var leftLimit = Number(item.left) + Number(depth);
            var rightLimit = Number(item.right) - Number(depth);
            docs.find({
                '$or' : [
                {
                    left: { '$gte': item.left, '$lte': leftLimit }
                },
                {
                    right: { '$gte': rightLimit, '$lte': item.right }
                }
                ],
                deletedDate: ''
            }).toArray(function (err, items) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, items);
                }
            });
        },
        function(items, cb) {
             db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, revisions, items);
                }
            });
        },
        function(revisions, items, cb) {
            totalResults = items.length;
            items.forEach(function(doc) {
                revisions.findOne({url: doc.url, locale: locale, latest: true, deletedDate: ''}, function(err, revision) {
                    if (err) {
                        res.send({
                            sc: RETURN_CODE.UNKNOWN_ERR,
                            sm: 'Unknown error has occurred'
                        });
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
            }
        }
    ]);
};

exports.saveDocument = function(req, res) {
    console.log('saveDocument', req.body);
    var input = req.body;
    var newRevision, url, locale, version, docBase;
    if ('em' in input && 'u' in input && 't' in input && 'c' in input && 'l' in input && 'is' in input && 'db' in input) {
        // TODO : user validation
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
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
    if ('em' in input && 'db' in input && 'u' in input && 'l' in input && 't' in input) {
        // TODO : user validation
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
    }

    // rename document
    saveDoc(input, SAVE_TYPE.RENAME, res);
}

exports.getDocument = function(req, res) {
    console.log('getDocument : ', req.body);
    var email, url, docBase, version, locale;
    var breadcrumbDocumentUrls = [];
    var breadcrumbDocumentTitles = [];
    var input = req.body;
    if ('em' in input && 'u' in input && 'db' in input && 'v' in input && 'l' in input) {
        // TODO : user validation
        email = input.em;
        url = input.u;
        docBase = input.db;
        version = String(input.v);
        locale = input.l.toLowerCase();
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection('docs', function(err, docs) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, docs);
                }
            });
        },
        function(docs, cb) {
            docs.findOne({url: url, locale:locale, docBase:docBase, version:version, deletedDate: ''}, function(err, doc) {
                if (doc) {
                    cb(null, doc);
                } else {
                    res.send({
                        sc: RETURN_CODE.CANNOT_FIND_DOC,
                        sm: 'Cannot find a document'
                    });
                }
            });
        },
        function(collection, doc, cb) {
            collection.find({left: {'$lte': doc.left}, right: {'$gte':doc.right}, latest: true, deletedDate: ''}).toArray(function (err, items) {
                for (var i = 0; i < items.length; i++) {
                    breadcrumbDocumentUrls.push(items[i].url);
                    breadcrumbDocumentTitles.push(items[i].title);
                }
                breadcrumbDocumentUrls.sort(function(a, b) {
                    return a.left - b.left;
                });
                breadcrumbDocumentTitles.sort(function(a, b) {
                    return a.left - b.left;
                });
            });
        },
        function(cb) {
            db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, revisions);
                }
            });
        },
        function(revisions, cb) {
            revisions.findOne({url: url, locale:locale, docBase:docBase, version:version, deletedDate: ''}, function(err, revision) {
                if (revision) {
                    cb(null, revision);
                } else {
                    res.send({
                        sc: RETURN_CODE.CANNOT_FIND_REVISION,
                        sm: 'Cannot find a revision'
                    });
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
        }
    ]);
}

exports.createDocument = function(req, res) {
    console.log('Create Document : ', req.body);
    var input = req.body;
    var newDoc = {};
    var newRevision = {};
    if ('em' in input && 'db' in input && 't' in input && 'l' in input && 'u' in input && 'pu' in input) {
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
        newRevision.authorId = 'todo'; // TODO
        newRevision.title = input.t;
        newRevision.content = 'just created';
        newRevision.locale = input.l.toLowerCase();
        newRevision.version = String(0);
        newRevision.latest = true;
        newRevision.createdDate = now.toUTCString();
        newRevision.deletedDate = '';
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
    }    
    async.waterfall([
        function(cb) {
            db.collection('docs', function(err, docs) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, docs);
                }
            });
        },
        function(docs, cb) {
            db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
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
                    res.send({
                        sc: RETURN_CODE.DOCUMENT_URL_ALREADY_EXIST,
                        sm: 'Document url already exist'
                    });
                }
            });
        },
        function(docs, revisions, cb) {
            docs.findOne({url: newDoc.parentDocumentUrl, docBase: newDoc.docBase, deletedDate: ''}, function(err, parent) {
                if (parent) {
                    console.log('found parent document');
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
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, revisions, resultDoc);
                }
            });
        },
        function(revisions, resultDoc, cb) {
            revisions.insert(newRevision, {}, function (err, resultRevision) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    res.send({
                        sc:RETURN_CODE.SUCCESS,
                        sm: 'Successfully created',
                        u: resultRevision[0].url,
                        t: resultRevision[0].title,
                        pu: resultDoc[0].parentDocumentUrl
                    });
                }
            })
        }
    ]);
}

exports.checkDocumentUrl = function(req, res) {
    console.log('checkDocumentUrl : ', req.body);
    var email, url, docBase;
    var input = req.body;
    if ('em' in input && 'u' in input && 'db' in input) {
        // TODO : user validation
        email = input.em;
        url = input.u;
        docBase = input.db;
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection('docs', function(err, collection) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, collection);
                }
            });
        },
        function(collection, cb) {
            collection.findOne({url: url, docBase:docBase, deletedDate: ''}, function(err, doc) {
                if (doc) {
                    res.send({
                        sc: RETURN_CODE.DOCUMENT_URL_ALREADY_EXIST,
                        sm: 'Document url already exist'
                    });
                } else {
                    res.send({
                        sc: RETURN_CODE.SUCCESS,
                        sm: 'Document url doesn\'t exist'
                    });
                }
            });
        }
    ]);
}

exports.deleteDocument = function(req, res) {
    console.log('deleteDocument : ', req.body);
    var email, url, docBase;
    var input = req.body;
    if ('em' in input && 'u' in input && 'db' in input) {
        // TODO : user validation
        email = input.em;
        url = input.u;
        docBase = input.db;
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection('docs', function(err, docs) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, docs);
                }
            });
        },
        function(docs, cb) {
            db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
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
                    res.send({
                        sc: RETURN_CODE.CANNOT_FIND_DOC,
                        sm: 'Cannot find a document'
                    });
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
                res.send({
                    sc: RETURN_CODE.SUCCESS,
                    sm: 'Successfully Deleted'
                });
            });
        },
    ]);
}

exports.getDocumentHistory = function(req, res) {
    console.log('getDocumentHistory : ', req.body);
    var email, url, docBase, locale, startPosition, length;
    var input = req.body;
    if ('em' in input && 'u' in input && 'db' in input && 'l' in input && 'le' in input && 's' in input) {
        // TODO : user validation
        email = input.em;
        url = input.u;
        docBase = input.db;
        locale = input.l.toLowerCase();
        startPosition = Number(input.s);
        length = Number(input.le);
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection('doc_revisions', function(err, revisions) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, revisions);
                }
            });
        },
        function(revisions, cb) {
            revisions.find({url: url, locale: locale}).toArray(function(err, revisions) {
                revisions.sort(function(a, b) {
                    return a.version - b.version;
                });

                if (revisions.length < startPosition) {
                    res.send({
                        sc: RETURN_CODE.INVALID_PARAM,
                        sm: 'Invalid parameter'
                    });
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
    if ('em' in input && 'v' in input) {
        email = input.em;
        value = input.v;
    } else {
        res.send({
            sc: RETURN_CODE.INVALID_PARAM,
            sm: 'Invalid parameter'
        });
    }

    // add user
    async.waterfall([
        function(cb) {
            // get users collection
            db.collection('users', function(err, collection) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, collection);
                }
            });
        },
        function(collection, cb) {
            // check admin user exist
            var query = {
                email: email
            };

            collection.find(query).toArray(function(err, docs) {
                if (err) {
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    if (!docs || docs.length < 1) {
                        // not exist
                        res.send({
                            sc: RETURN_CODE.CANNOT_FIND_USER,
                            sm: '"' + email + '" user not exist'
                        });
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
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    if (docs && docs.length > 0) {
                        // already exist
                        res.end({
                            sc: RETURN_CODE.USER_ALREADY_EXIST,
                            sm: '"' + value + '" user already exist'
                        });
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
                    res.send({
                        sc: RETURN_CODE.UNKNOWN_ERR,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    res.send({
                        sc: RETURN_CODE.SUCCESS,
                        sm: 'Successfully add new user'
                    });
                }
            });
        }
    ]); // close async.waterfall
}
