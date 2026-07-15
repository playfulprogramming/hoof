import { Tasks } from "@playfulprogramming/bullmq";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";

export default createProcessor(Tasks.DELETE_S3_OBJECT, async (job) => {
	const { bucket, key } = job.data;
	await s3.remove(bucket, key);
	console.log(`Removed ${bucket}/${key} from S3 after grace period`);
});
