import { Log } from '@worthy-npm/worthy-logger'
import { Service } from '@worthy-npm/node-service-bootstrap'
import { KeyVal, Apis } from './constants'
import { BuyerRecommendationApi } from './buyerRecomendationApi'

const ServerNames:KeyVal = {
	SERVER_A: 'SERVER_A',
	SERVER_B: 'SERVER_B',
}

const failureMessageSent = {
	[ServerNames.SERVER_A]: false,
	[ServerNames.SERVER_B]: false,
}

function checkForcedServer() {
	if (process.env.FORCE_PREDICTOR_SERVER) {
		Log.info(`Identified FORCE_PREDICTOR_SERVER request: ${process.env.FORCE_PREDICTOR_SERVER}`)

		if (ServerNames[process.env.FORCE_PREDICTOR_SERVER]) {
			const selected = ServerNames[process.env.FORCE_PREDICTOR_SERVER]
			Log.info(`Selecting Predictor server ${selected} for further processing`)
			return true
		}
		Log.error('Requested forced server unknown. continuing with normal flow.')
	}
	return false
}

export async function verifyRecsysVersion() : Promise<any> {
	Log.info('Checking predictor servers for updated version')
	if (checkForcedServer()) {
		return
	}
  
	const serverAreq = new BuyerRecommendationApi(process.env.SERVER_A)

	const serverBreq = new BuyerRecommendationApi(process.env.SERVER_B)



	const modelIdA = (serverAreq && await serverAreq.getModelId()) || 'FAILED'
	const modelIdB = (serverBreq && await serverBreq.getModelId()) || 'FAILED'

	Log.info(`Predictor server ${ServerNames.SERVER_A} model id is ${modelIdA}`)
	Log.info(`Predictor server ${ServerNames.SERVER_B} model id is ${modelIdB}`)

	let selected = modelIdA >= modelIdB ? ServerNames.SERVER_A : ServerNames.SERVER_B
	if (modelIdA === 'FAILED' && modelIdB === 'FAILED') {
		await Service.fireAlarm('Buyer Recommendation system is unavailable, predictor servers failed the predictor version checker, contact Guy')
	}
  
	if (modelIdA === 'FAILED' && modelIdB > 0) selected = ServerNames.SERVER_B
	if (modelIdB === 'FAILED' && modelIdA > 0) selected = ServerNames.SERVER_A

	Log.info(`Selecting Predictor server ${selected} for further processing`)
	Apis.recsys = new BuyerRecommendationApi(process.env[ServerNames[selected]])
}

export async function startRecsysVersionChecks() {
	await verifyRecsysVersion()
	const intervalMinutes:number = Number(process.env.VERIFY_PREDICTOR_VERSION_INTERVAL_MINUTES) || 60
	Log.info(`Version test interval set to ${intervalMinutes} minutes`)
	setInterval(verifyRecsysVersion, intervalMinutes * 60 * 1000)
}