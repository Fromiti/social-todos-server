import validator from "validator";
import {AUTH_APPS, UserRegisterInput} from "../entity/input/UserRegister";
import crypto from 'crypto'
import {MutationError} from "../entity/interfaces/IMutationResponse";
import {User} from "../entity/User";
import fetch from "node-fetch";
import {OAuth2Client} from 'google-auth-library';

export const validateRegister = (data: UserRegisterInput): MutationError[] => {
    const errors: MutationError[] = []
    if (validator.isEmpty(data.email) || !validator.isEmail(data.email)) {
        errors.push({msg: "No es un email valido!", path: "email"})
    }
    if (validator.isEmpty(data.name) || !validator.isLength(data.name, {min: 10, max: 100})) {
        errors.push({msg: "Tu nombre debe tener entre 10 y 100 caracteres!", path: "name"})
    }

    if (validator.isEmpty(data.password) || !validator.isLength(data.password, {min: 5, max: 30})) {
        errors.push({msg: "La contrasena debe tener entre 5 y 30 caracteres!", path: "password"})
    }

    return errors
}

export const getEncryptedCredentials = (password: string, github = false, google = false): { password: string, salt: string } => {
    const salt = crypto.randomBytes(16).toString('base64')
    let finalPass = password
    if (!process.env.GOOGLE_PASS || !process.env.GITHUB_PASS) {
        throw new Error('Variables de entorno google pass y github pass no definidas...')
    }
    if (github) finalPass = process.env.GITHUB_PASS
    if (google) finalPass = process.env.GOOGLE_PASS
    const encryptedPassword = crypto.pbkdf2Sync(
        finalPass,
        salt, 10000, 64, 'sha1')
        .toString('base64')
    return {salt, password: encryptedPassword}
}

interface IVerifyPassword {
    inputPassword: string,
    encryptedPassword: string,
    salt: string
}

export const verifyPassword = ({inputPassword, encryptedPassword, salt}: IVerifyPassword): boolean => {
    const encryptedInputPass = crypto.pbkdf2Sync(inputPassword, salt, 10000, 64, 'sha1')
        .toString('base64')
    return encryptedPassword === encryptedInputPass
}

export const getSocialUser = async (token: string, type: AUTH_APPS): Promise<Partial<User>> => {
    let socialUser : Partial<User> = {}
    if (type == 0) {
         const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
         const loginTicket = await googleClient.verifyIdToken({
             idToken: token,
             audience: process.env.GOOGLE_CLIENT_ID
         })
        const googleUser = loginTicket.getPayload()
        socialUser.email = googleUser?.email
        socialUser.name = googleUser?.name
        socialUser.image = googleUser?.picture
        socialUser.google = true
    }
    if (type == 1) {
        const userDataRes = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`
            }
        })
        const githubData = await userDataRes.json()

        socialUser.name= githubData.name
        socialUser.email= githubData.email
        socialUser.description= githubData.bio
        socialUser.image= githubData.avatar_url
        socialUser.github= true
    }
    socialUser.bornDate = new Date()
    return socialUser
}
