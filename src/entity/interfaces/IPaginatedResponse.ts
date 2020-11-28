import {ClassType, Field, ObjectType} from "type-graphql";

export default function PaginatedResponse<TItem>(TItemClass: ClassType<TItem>) {
    // `isAbstract` decorator option is mandatory to prevent registering in schema
    @ObjectType({isAbstract: true})
    abstract class PaginatedResponseClass {
        // here we use the runtime argument
        @Field(() => [TItemClass])
        items!: TItem[];

        @Field(() => String, {nullable: true})
        cursor!: string | null;

        @Field()
        hasMore!: boolean;
    }
    return PaginatedResponseClass;
}
