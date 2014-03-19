var express = require('express'),
    wikidb = require('./routes/wikidb');

var app = express();

app.configure(function () {
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        next();
    });
    app.use(app.router);
});

app.post('/getDocument', wikidb.getDocument);
app.post('/createDocument', wikidb.createDocument);
app.post('/saveDocument', wikidb.saveDocument);
app.post('/getDocumentTree', wikidb.getDocumentTree);
app.post('/checkoutDocumentUrl', wikidb.checkoutDocumentUrl);
app.post('/deleteDocument', wikidb.deleteDocument);
app.post('/getDocumentHistory', wikidb.getDocumentHistory);
app.post('/renameDocument', wikidb.renameDocument)

app.listen(3000);
console.log('Listening on port 3000...');
