import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

let cachedJwtKey: string | undefined;
let cachedPasswordHash: string | undefined;
let ssmClient: SSMClient | undefined;

function client(): SSMClient {
  if (!ssmClient) ssmClient = new SSMClient({});
  return ssmClient;
}

async function fetch(parameterName: string): Promise<string> {
  const result = await client().send(
    new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
  );
  const value = result.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${parameterName} is empty or missing`);
  return value;
}

export async function getJwtKey(): Promise<string> {
  if (cachedJwtKey) return cachedJwtKey;
  const name = process.env.JWT_KEY_PARAM;
  if (!name) throw new Error('JWT_KEY_PARAM env var is not set');
  cachedJwtKey = await fetch(name);
  return cachedJwtKey;
}

export async function getPasswordHash(): Promise<string> {
  if (cachedPasswordHash) return cachedPasswordHash;
  const name = process.env.PASSWORD_HASH_PARAM;
  if (!name) throw new Error('PASSWORD_HASH_PARAM env var is not set');
  cachedPasswordHash = await fetch(name);
  return cachedPasswordHash;
}

/** Test-only: clear the module-scope cache between cases. Not exported via the package barrel. */
export function __resetSecretsCacheForTests(): void {
  cachedJwtKey = undefined;
  cachedPasswordHash = undefined;
  ssmClient = undefined;
}
