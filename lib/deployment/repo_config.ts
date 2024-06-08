export interface RepoConfig {
    readonly repoString: string;
    readonly repoBranch: string;
    readonly repoName: string;
}

export const CODE_STAR_CONNECTION = "arn:aws:codestar-connections:us-west-2:372183484622:connection/64b8365d-05c1-412a-98a9-7873a6fdbcff";

export const CDK_REPO: RepoConfig = {
    repoString: "YingjingLu/MacroSurferCDK",
    repoBranch: "main",
    repoName: "MacroSurferCDK"
};

export const REPO_LIST: Array<RepoConfig> = [
    {
        repoString: "YingjingLu/MacroSurferLambda",
        repoBranch: "main",
        repoName: "MacroSurferLambda"
    },
    {
        repoString: "YingjingLu/MacroSurferService",
        repoBranch: "main",
        repoName: "MacroSurferService"
    }
];

