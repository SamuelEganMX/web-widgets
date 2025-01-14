import { EditableValue } from "mendix";
import { matchSorter } from "match-sorter";
import { CaptionsProvider, OptionsProvider, Status } from "../types";
import { TypeaheadEnum } from "../../../typings/DropdownProps";

export class EnumBoolOptionsProvider<T extends boolean | string>
    implements OptionsProvider<T, { attribute: EditableValue<string | boolean> }>
{
    status: Status = "available";
    private isBoolean = false;
    private searchTerm = "";
    private options: string[] = [];

    hasMore = false;

    constructor(private caption: CaptionsProvider) {}

    loadMore(): void {
        return undefined;
    }

    _updateProps(props: { attribute: EditableValue<string | boolean> }) {
        if (props.attribute.status === "unavailable") {
            this.options = [];
        }

        this.options = (props.attribute.universe ?? []).map(o => o.toString());
        this.isBoolean = typeof props.attribute.universe?.[0] === "boolean";
    }

    _optionToValue(value: string | null): T | undefined {
        if (this.isBoolean) {
            return (value === "true") as T;
        } else {
            return (value ?? undefined) as T;
        }
    }

    _valueToOption(value: string | boolean | undefined): string | null {
        return value?.toString() ?? null;
    }

    getAll(sortType: TypeaheadEnum): string[] {
        switch (sortType) {
            case "contains":
                return matchSorter(this.options, this.searchTerm || "", { keys: [v => this.caption.get(v)] });
            case "startsWith":
                return matchSorter(this.options, this.searchTerm || "", {
                    threshold: matchSorter.rankings.WORD_STARTS_WITH,
                    keys: [v => this.caption.get(v)]
                });
            case "no":
                return matchSorter(this.options, this.searchTerm || "", {
                    threshold: matchSorter.rankings.NO_MATCH,
                    keys: [v => this.caption.get(v)]
                });
        }
    }

    setSearchTerm(term: string): void {
        this.searchTerm = term;
    }
}
