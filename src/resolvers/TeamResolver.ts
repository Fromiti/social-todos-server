import {Arg, Authorized, Ctx, FieldResolver, Mutation, Query, Resolver, Root} from "type-graphql";
import {Team} from "../entity/Team";
import {CreateTeamInput} from "../entity/input/TeamInput";
import {UserToTeam} from "../entity/UserToTeam";
import {AuthContext} from "../types/graphql";
import {TeamResponse} from "../entity/responses/TeamResponse";
import {uploadFile} from "../utils/uploads";
import {getEncryptedCredentials} from "../utils/auth";


@Resolver(Team)
export class TeamResolver {

    @FieldResolver()
    isPublic(@Root() team: Team) {
        return team.password === null
    }

    @Query(() => [Team], {description: "Get Teams!"})
    teams() {
        return Team.find({relations: ['users', 'users.user']})
    }

    @Query(() => Team, {nullable: true, description: "Get One Team by team id param"})
    async team(@Arg('id') id: number): Promise<Team | null> {
        return await Team.findOne({where: {id}, relations: ['users', 'users.user']}) || null
    }

    @Authorized()
    @Mutation(() => TeamResponse)
    async joinTeam(@Arg('id', {description: "Team ID"}) id: number, @Ctx() ctx: AuthContext): Promise<TeamResponse> {
        try {
            const userExist = await UserToTeam.findOne({where: {teamId: id, userId: ctx.user.id}})
            if (userExist) return {ok: false, msg: "Ya eres parte del equipo!", errors: [{path: "id", msg: "Duplicado"}]}
            const team = await Team.findOne({where: {id}})
            if (!team) return {ok: false, msg: "El equipo no existe!", errors: [{path: "id", msg: "No existe"}]}
            await UserToTeam.create({userId: ctx.user.id, teamId: id, userIsAdmin: false}).save()
            return {ok: true, msg: "Bienvenido a tu nuevo equipo: " + team.name, team}
        } catch (e: unknown) {
            return {ok: false, msg: JSON.stringify(e)}
        }
    }

    @Authorized()
    @Mutation(() => TeamResponse)
    async createTeam(@Arg('data') data: CreateTeamInput, @Ctx() ctx: AuthContext): Promise<TeamResponse> {
        try {
            const imageURL = await uploadFile(data.image, 'teams')
            let pass: null | string = null;
            let _salt: null | string = null;
            if (data.password) {
                const {password, salt} = getEncryptedCredentials(data.password)
                pass = password
                _salt = salt
            }
            const newTeam = await Team.create({...data, password: pass, salt: _salt, image: imageURL}).save()
            await UserToTeam.create({userId: ctx.user.id, team: newTeam, userIsAdmin: true}).save()
            return {ok: true, msg: "Equipo Creado", team: newTeam}
        } catch (e: unknown) {
            return {ok: false, msg: JSON.stringify(e)}
        }
    }
}

