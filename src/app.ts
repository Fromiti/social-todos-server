import "reflect-metadata";
import express from 'express'
import bodyParser from "body-parser";
import {createConnection} from "typeorm";
import {buildSchema, ForbiddenError} from "type-graphql";
import jwt from 'jsonwebtoken'
import * as http from "http";
import fetch from "node-fetch";
import {ApolloServer} from "apollo-server-express";
import {authChecker} from "./auth/AuthChecker";
import {AuthUser, Context} from "./types/graphql";
import {schemaQuery} from "./utils/schemaQuery";

class App {

    private readonly app: express.Application = express()
    private readonly port: string | number = process.env.PORT || 4000
    private readonly path: string = "/graphql"

    verifyToken(token: string): AuthUser | null {
        try {
            return jwt.verify(token, 'TypeGraphQL') as AuthUser
        } catch (e) {
            return null
        }
    }

    setParser(): void {
        this.app.use(bodyParser.json())
        this.app.use(bodyParser.urlencoded({extended: false}))
    }

    setIndexRoute(): void {
        this.app.get('/', async (req, res) => {
            const response = await fetch('http://localhost:4000/graphql', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: schemaQuery}),
            })
            const {data} = await response.json()
            res.json({
                graphql_endpoint: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000/graphql',
                graphl_playground: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000/graphql',
                server_health: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000/.well-known/apollo/server-health',
                ...data
            })
        })
    }

    async getApolloGraphServer(): Promise<ApolloServer> {
        const schema = await buildSchema({
            resolvers: [__dirname + "/resolvers/**/*.{ts,js}"],
            authChecker
        });
        return new ApolloServer({
            schema,
            introspection: true,
            playground: {
                settings: {
                    "editor.fontSize": 24,
                }
            },
            formatError(error) {
                if (error.originalError instanceof ForbiddenError) {
                    return new Error('No estas autenticado, verifica el token de acceso.');
                }
                return error
            },
            context: (context): Context => {
                let user = null;
                if (context.connection) {
                    if (context.connection.context.authorization) {
                        user = this.verifyToken(context.connection.context.authorization)
                    }
                } else if (context.req.headers.authorization) {
                    user = this.verifyToken(context.req.headers.authorization)
                }
                return {
                    req: context.req,
                    user
                }
            }
        })
    }

    async start(): Promise<void> {
        await createConnection()
        this.setParser()
        this.setIndexRoute();
        const apolloServer = await this.getApolloGraphServer()
        apolloServer.applyMiddleware({app: this.app, path: this.path})
        const httpServer = http.createServer(this.app);
        apolloServer.installSubscriptionHandlers(httpServer);
        httpServer.listen(this.port, () => {
            console.log(`Server ready at http://localhost:${this.port}${apolloServer.graphqlPath}`)
            console.log(`Subscriptions ready at ws://localhost:${this.port}${apolloServer.subscriptionsPath}`)
        })
    }
}

const app = new App()
app.start()



