const config = require('config');
const { graphql } = require('@octokit/graphql');

const getArgs = require('./lib/get-args');


const octoql = graphql.defaults({
    headers: {
        authorization: `token ${config.githubConnection.apikey}`
    }
});

(async () => {

    try {

        const repoList = getArgs();
        if (repoList.length < 1) {
            throw {message: "You must specify a repo name."};
        }

        const repoName = repoList[0];


        // Get the repository ID.
        const { repository } = await octoql(`
            query getRepoID( $owner: String!, $repoName: String!) {
                repository(owner: $owner, name: $repoName) {
                    id
                }
            }
            `,
            {
                owner: config.githubConnection.orgname,
                repoName: repoName
            }
        );

        // Deliberately not taking advantage of async in order to enforce ordering.
        for (const branchPattern of config.branches) {

            // Create the protection rule.
            await octoql(
                `
                    mutation($input: CreateBranchProtectionRuleInput!) {
                        createBranchProtectionRule(input: $input) {
                            branchProtectionRule {
                                id
                            }
                        }
                    }
                    `,
                {
                    input: {
                        repositoryId: repository.id,
                        pattern: branchPattern,

                        requiresApprovingReviews: true,     // Require pull request reviews before merging.
                        requiredApprovingReviewCount: 1,    // At least one review.
                        requiresStatusChecks: true,         // Status checks must pass.
                        requiresStrictStatusChecks: true,   // Branches must be up to date before merging.
                        isAdminEnforced: false,             // Don't enforce the above rules for admins.
                        restrictsPushes: true,              // Restrict who can push to matching branches.
                        allowsDeletions: true               // Allow deletions.
                    }
                }
            );
        }


    } catch (error) {
        console.error(error.message);
    }

})();

