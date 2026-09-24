import { Type } from "typebox";
import { Settings } from "typebox/system";
import { Value } from "typebox/value";

const EnvSchema = Type.Object({
	MOCK_PROXY_PORT: Type.Integer({ default: 3999 }),
});

Settings.Set({ correctiveParse: true });
export const env = Value.Parse(EnvSchema, { ...process.env });
