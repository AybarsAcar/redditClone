import { ObjectType, Field, Int } from "type-graphql";
import {
  Entity,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Column,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "typeorm";
import { User } from "./User";
import { Updoot } from "./Updoot";

// post db table -- connect it to graphqlschema
@ObjectType()
@Entity()
export class Post extends BaseEntity {
  // id of the post
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  // single title field -- its a regular column
  @Field()
  @Column()
  title!: string;

  @Field()
  @Column()
  text!: string;

  // upvotes and downvotes
  @Field()
  @Column({ type: "int", default: 0 })
  points!: number;

  // only a gql schema value -- not on the db itself
  @Field(() => Int, { nullable: true })
  voteStatus: number | null;

  // foreign key
  @Field()
  @Column()
  creatorId: number;

  // this sets up a foreign key
  // set a relationship to User
  @Field()
  @ManyToOne(() => User, (user) => user.posts)
  creator: User;

  @OneToMany(() => Updoot, (updoot) => updoot.post)
  updoots: Updoot[];

  //
  @Field(() => String)
  @CreateDateColumn()
  createdAt = Date;

  // creates a date on update
  @Field(() => String)
  @UpdateDateColumn()
  updatedAt = Date;
}
