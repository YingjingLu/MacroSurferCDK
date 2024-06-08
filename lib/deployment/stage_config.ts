export interface StageConfig {
    readonly account: string;
    readonly region: string;
    readonly name: string;
}

export const STAGE_LIST: Array<StageConfig> = [
    {
        account: "372183484622",
        region: "us-west-2",
        name: "prod"
    }
]
