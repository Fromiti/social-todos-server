import "reflect-metadata";
import {config} from 'dotenv'
import express from 'express'
import bodyParser from "body-parser";
import {createConnection} from "typeorm";
import {buildSchema, ForbiddenError} from "type-graphql";
import * as http from "http";
import fetch from "node-fetch";
import {ApolloServer} from "apollo-server-express";
import {authChecker} from "./auth/AuthChecker";
import {schemaQuery} from "./utils/schemaQuery";
import cors from 'cors'
import {tokenChecker} from "./utils/auth";
import fs from 'fs'
import https, {ServerOptions} from 'https'

config()

/*const cert = fs.readFileSync('src/ssl/lucasignacio_me.crt');
const ca = fs.readFileSync('src/ssl/lucasignacio_me.ca-bundle');
const key = fs.readFileSync('src/ssl/lucasignacio_me.key');

const httpsOptions: ServerOptions = {
    key,
    cert,
    ca
}

https.createServer(httpsOptions, function (req, res) {
    res.writeHead(200);
    res.end("Welcome to Node.js HTTPS Servern");
}).listen(8443)*/

class App {
    private readonly app: express.Application = express()
    private readonly port: string | number = process.env.PORT || 4000
    private readonly path = "graphql"
    private readonly production = process.env.NODE_ENV === "production"
    private readonly url = this.production ? 'https://social-todos-graph.herokuapp.com/' : 'http://localhost:4000/'


    setParserAndCors(): void {
        this.app.use(bodyParser.json())
        this.app.use(bodyParser.urlencoded({extended: false}))
        this.app.use(cors({
            origin: ['http://localhost:3000', 'https://social-todos-web.vercel.app', 'https://social-todos-graph.herokuapp.com/', 'http://localhost:4000'],
            credentials: true
        }))
    }

    setIndexRoute(): void {
        this.app.get('/', async (req, res) => {
            const response = await fetch(this.url + 'graphql', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: schemaQuery}),
            })
            const json: { data: object } = await response.json()
            res.json({
                graphql_endpoint: this.url + this.path,
                graphl_playground: this.url + this.path,
                server_health: this.url + ".well-known/apollo/server-health",
                ...json.data
            })
        })
    }

    async getApolloGraphServer(): Promise<ApolloServer> {
        const schema = await buildSchema({
            resolvers: [__dirname + "/resolvers/**/*.{ts,js}"],
            authChecker,
            validate: false
        });
        return new ApolloServer({
            schema,
            introspection: true,
            playground: {settings: {"editor.fontSize": 24,}},
            formatError(error) {
                if (error.originalError instanceof ForbiddenError) {
                    return new Error('No estas autenticado, verifica el token de acceso.');
                }
                return error
            },
            context: tokenChecker
        })
    }

    async start(): Promise<void> {
        await createConnection()
        this.setParserAndCors()
        this.setIndexRoute();
        const apolloServer = await this.getApolloGraphServer()
        apolloServer.applyMiddleware({app: this.app, path: '/' + this.path})
        const httpServer = http.createServer(this.app);
        apolloServer.installSubscriptionHandlers(httpServer);
        httpServer.listen(this.port, () => {
            console.log(`Server ready at ${this.url}${apolloServer.graphqlPath}`)
            console.log(`Subscriptions ready at wss://same-path`)
        })
    }
}

const app = new App()
app.start()



