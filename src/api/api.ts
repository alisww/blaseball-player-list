import { getAllModIds, Player, RosterEntry } from "../models/Player";
import { generatePlayerTeamMap } from "../utils";
import {
    BlaseballPlayer,
    BlaseballTeam,
    ChroniclerEntities,
    ChroniclerEntity,
    PlayerMod,
} from "./types";
import attributes from './attributes.json';
import queryString from "query-string";

export interface LeagueData {
    players: Record<string, Player>;
    teams: Record<string, BlaseballTeam>;
    roster: Record<string, RosterEntry[]>;
    mods: Record<string, PlayerMod>;
}

export async function fetchLeagueData(at: string | null): Promise<LeagueData> {
    const [[players, mods], teams] = await Promise.all([
        fetchPlayersAndMods(at),
        fetchTeams(at),
    ]);

    const teamMap = Object.fromEntries(
        teams.map((t) => [t.entityId, t.data])
    );
    const rosterMap = generatePlayerTeamMap(teams);
    const modMap = Object.fromEntries(mods.map((m) => [m.id, m]));
    const playerObjects = Object.fromEntries(
        players.map((p) => [
            p.entityId,
            new Player(p, teamMap, rosterMap),
        ])
    );

    return {
        players: playerObjects,
        teams: teamMap,
        roster: rosterMap,
        mods: modMap,
    };
}

async function fetchPlayersAndMods(
    at: string | null
): Promise<[ChroniclerEntity<BlaseballPlayer>[], PlayerMod[]]> {
    const players = await fetchEntities<BlaseballPlayer>("player", at);
    const modIds = getAllModIds(players);
    const mods: PlayerMod[] = attributes.filter(a => modIds.indexOf(a.id) !== -1);
    return [players, mods];
}

async function fetchTeams(
    at: string | null
): Promise<ChroniclerEntity<BlaseballTeam>[]> {
    return await fetchEntities<BlaseballTeam>("team", at);
}

async function fetchEntities<T>(
    type: string, at: string | null
) : Promise<ChroniclerEntity<T>[]> {
    const pages: ChroniclerEntities<T>[] = [];
    const offset: number = parseInt(document!.cookie!.split('; ').find(row => row.startsWith('offset_sec'))!.split('=')[1])!;
    at = new Date((new Date().getTime() - offset * 1000)).toISOString();
    do {
        pages.push(await fetchJson<ChroniclerEntities<T>>(
            queryString.stringifyUrl({
                url: "https://api.sibr.dev/chronicler/v2/entities",
                query: {
                    type: type,
                    at: at ?? undefined,
                    page: pages[pages.length - 1]?.nextPage ?? undefined
                },
            })
        ));
    } while (pages[pages.length - 1]?.nextPage);
    return pages.flatMap((page) => page.items);
}

async function fetchJson<T>(url: string): Promise<T> {
    const resp = await fetch(url, {
        mode: "cors",
    });
    return (await resp.json()) as T;
}
