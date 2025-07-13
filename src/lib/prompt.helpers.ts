import { ActionDeclarations } from "./tools";

/*
** available actions and descriptions from ActionDeclarations
*/
export const availableActions = () => {
    const cloned = JSON.parse(JSON.stringify(ActionDeclarations));
    return cloned.map((action: any) => ({
        name: action.name,
        description: action.description
    }));
}