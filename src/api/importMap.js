'use strict'

import logger from 'winston'
import * as authorisation from './authorisation'
import * as utils from '../utils'
import { ImportMapModelAPI } from '../model/importMap'

/**
 * Checks admin permission for create, update and delete operations.
 * Throws error if user does not have admin access
 * @param {*} ctx 
 * @param {*} operation 
 */
const checkUserPermission = (ctx, operation) => {
    if (!authorisation.inGroup('admin', ctx.authenticated)) {
        ctx.statusCode = 403
        throw Error(
            `User ${ctx.authenticated.email} is not an admin, API access to ${operation} an app denied.`
        )
    }
}

/**
 * Checks if an Import Map record exists, returns when found, throws an error if it doesn't
 * @param {*} ctx 
 * @param {*} importMapId 
 * @returns 
 */
const checkImportMapExists = async (ctx, importMapId) => {
    const importMap = await ImportMapModelAPI.findById(importMapId)

    if (!importMap) {
        ctx.statusCode = 404
        throw Error(`Import Map with id ${importMapId} does not exist`)
    }

    return importMap
}

/**
 * Creates error response for operations create, read, update and delete
 * @param {*} ctx 
 * @param {*} operation 
 * @param {*} error 
 */
const createErrorResponse = (ctx, operation, error) => {
    logger.error(`Could not ${operation} an import map via the API: ${error.message}`)

    ctx.body = {
        error: error.message
    }
    ctx.status = ctx.statusCode ? ctx.statusCode : 500
}

/**
 * Creates a new Import Map record
 * @param {*} ctx 
 * @returns 
 */
export async function addImportMap(ctx) {
    try {
        checkUserPermission(ctx, 'add')
        const importMapData = ctx.request.body

        const importMap = new ImportMapModelAPI(importMapData)
        await importMap.save()

        logger.info(
            `Importmap ${ctx.authenticated.name} created with id ${importMap.id}`
        )

        ctx.body = 'Import Map successfully created'
        ctx.status = 201
    } catch (e) {
        createErrorResponse(ctx, 'add', e)
    }

}

/**
 * Retrieves details of a single Import Map record by ID
 * @param {*} ctx 
 * @param {*} importMapId 
 * @returns 
 */
export async function getImportMap(ctx, importMapId) {
    try {
        const importMap = await checkImportMapExists(ctx, importMapId)

        logger.info(`User ${ctx.authenticated.email} fetched import map with id: ${importMapId}`)

        ctx.body = importMap
        ctx.status = 200
    } catch (e) {
        createErrorResponse(ctx, 'retrieve', e)
    }
}

/**
 * Retrieves all Import Map records with their details
 * @param {*} ctx 
 * @returns 
 */
export async function getImportMaps(ctx) {
    try {
        const importMaps = await ImportMapModelAPI.find(ctx.request.query)

        logger.info(`User ${ctx.authenticated.email} fetched ${importMaps.length} import maps`)

        ctx.body = importMaps
        ctx.status = 200
    } catch (e) {
        createErrorResponse(ctx, 'retrieve')
    }
}

/**
 * Updates Import map record
 * @param {*} ctx 
 * @param {*} importMapId 
 * @returns 
 */
export async function updateImportMap(ctx, importMapId) {
    try {
        checkUserPermission(ctx, 'update')
        await checkImportMapExists(ctx, importMapId)

        const importMapData = ctx.request.body

        await ImportMapModelAPI.findByIdAndUpdate(importMapId, importMapData).exec()

        logger.info(
            `User ${ctx.authenticated.email} updated Import Map with id ${importMapId}`
        )
        ctx.body = 'Successfully updated Import Map.'
    } catch (e) {
        createErrorResponse(ctx, 'update', e)
    }
}

/**
 * Deletes an Import Map record by id
 * @param {*} ctx 
 * @param {*} importMapId 
 * @returns 
 */
export async function deleteImportMap(ctx, importMapId) {
    try {
        checkUserPermission(ctx, 'delete')
        await checkImportMapExists(ctx, importMapId)

        await ImportMapModelAPI.deleteOne({ _id: importMapId })
            .then(() => {
                logger.info(`User ${ctx.authenticated.email} deleted Import Map ${importMapId}`)
                ctx.status = 200
                ctx.body = {
                    success: true
                }
            })

    } catch (e) {
        createErrorResponse(ctx, 'delete', e)
    }
}