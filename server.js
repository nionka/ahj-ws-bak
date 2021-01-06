const http = require('http');
const Koa = require('koa');
const koaBody = require('koa-body');
const Router = require('koa-router');
const WS = require('ws');
const { v4: uuidv4 } = require('uuid'); // вызов uuidv4()
const router = new Router();
const app = new Koa();

app.use(koaBody({
    urlencoded: true,
    multipart: true,
    json: true,
}));

app.use(async (ctx, next) => {
    const origin = ctx.request.get('Origin');
    if (!origin) {
      return await next();
    }
    const headers = { 'Access-Control-Allow-Origin': '*', };
  
    if (ctx.request.method !== 'OPTIONS') {
      ctx.response.set({...headers});
      try {
        return await next();
      } catch (e) {
        e.headers = {...e.headers, ...headers};
        throw e;
      }
    }
  
    if (ctx.request.get('Access-Control-Request-Method')) {
      ctx.response.set({
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
      });
  
      if (ctx.request.get('Access-Control-Request-Headers')) {
        ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
      }
      ctx.response.status = 204;
    }
});

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback()).listen(port);

const wsServer = new WS.Server({ server });
const users = [];

wsServer.on('connection', ws => {

    ws.on('message', msg => {        
        const body = JSON.parse(msg);
        
        if (body.type === 'authorization') {
            if (users.includes(body.name)) {
                body.name = false;
                ws.send(JSON.stringify(body));
            } else {
                users.push(body.name);
                ws.send(msg);
                wsServer.clients.forEach(client => {
                    if (client.readyState === WS.OPEN) {
                        client.send(JSON.stringify(users));
                    }
                })
            }
        }

        if (body.type === 'message') {
            wsServer.clients.forEach(client => {
                if (client.readyState === WS.OPEN) {
                    client.send(JSON.stringify(body));
                }
            })
        }

        if (body.type === 'disconnect') {
            const index = users.indexOf(body.name);
            users.splice(index, 1);
            wsServer.clients.forEach(client => {
                if (client.readyState === WS.OPEN) {
                    client.send(JSON.stringify(users));
                }
            })
        }
    })    
})

app
  .use(router.routes())
  .use(router.allowedMethods());

