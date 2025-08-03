import { invoke } from "@tauri-apps/api/core";
import type { WebsiteSkills } from "./task.browser.schemas";
import type { RemoteOptions } from "./task.browser.schemas";
import SKILLS from "./skills.json" with { type: "json" };

/*
** registry
*/
export class SkillRegistry {
    private sites = new Map<string, WebsiteSkills>();
    private cache = new Map<string, WebsiteSkills>();

    /*
    ** get skills
    */
    private async fetchFromBackend(
        domain: string,
        { 
            company = "runtime-org",
            repo = "sk",
            branch = "main"
        }: RemoteOptions = {}
    ): Promise<WebsiteSkills> {
        return await invoke<WebsiteSkills>("load_skills", {
            domain,
            company,
            repo,
            branch
        });
    }
    
    // private loadFromRemote(domain: string): WebsiteSkills {
    //     const website = SKILLS.websites.find((w: any) => w.domain === domain);
    //     if (!website) throw new Error(`No skills found for domain: ${domain}`);

    //     return {
    //         domain: website.domain,
    //         skills: website.skills as WebsiteSkills["skills"]
    //     };
    // }

    private loadFromLocal(domain: string): WebsiteSkills {
        const website = SKILLS.websites.find((w: any) => w.domain.includes(domain));
        if (!website) throw new Error(`No skills found for domain: ${domain}`);

        return {
            domain: website.domain[0],
            skills: website.skills as WebsiteSkills["skills"]
        };
    }

    private fuzzyMatch(targetDomain: string): WebsiteSkills | null {
        if (this.sites.has(targetDomain)) {
            return this.sites.get(targetDomain)!;
        }

        const getBaseDomain = (domain: string): string => {
            const lastDotIndex = domain.lastIndexOf('.');
            return lastDotIndex > 0 ? domain.substring(0, lastDotIndex) : domain;
        };

        const targetBase = getBaseDomain(targetDomain);

        for (const [existingDomain, skills] of this.sites.entries()) {
            const existingBase = getBaseDomain(existingDomain);
            if (existingBase === targetBase) {
                return skills;
            }
        }
        return null;
    }

    /*
    ** get the full skill definition for a domain with caching
    */
    async byDomains(domains: string[]): Promise<WebsiteSkills[]> {
        const sites: WebsiteSkills[] = [];

        for (const domain of domains) {
            try {
                const existingSite = this.fuzzyMatch(domain);

                if (existingSite) {
                    sites.push(existingSite);
                } else {
                    const skills = this.loadFromLocal(domain) as WebsiteSkills;
                    this.sites.set(domain, skills);
                    sites.push(skills);
                }
            } catch (error) {
                console.warn("error", error.message);
            }
        }
        return sites;
    }
}
