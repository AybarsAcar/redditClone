import { UsernamePasswordInput } from "../resolvers/UsernamePasswordInput";

export const validateRegister = (options: UsernamePasswordInput) => {
  if (!options.email.includes("@")) {
    return [
      {
        field: "email",
        message: "Invalid email",
      },
    ];
  }
  if (options.username.length < 6) {
    return [
      {
        field: "username",
        message: "Username has to be at least 6 characters",
      },
    ];
  }

  if (options.username.includes("@")) {
    return [
      {
        field: "username",
        message: "Username can not include an @ sign",
      },
    ];
  }

  if (options.password.length < 6) {
    return [
      {
        field: "password",
        message: "Password has to be at least 6 characters",
      },
    ];
  }

  return null;
};
