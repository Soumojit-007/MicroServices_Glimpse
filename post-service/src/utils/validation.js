// import Joi from 'joi'

// export const validateCreatePost = (data) => {
//   const schema = Joi.object({
//     content: Joi.string().min(3).max(5000).required(),
//     mediaIds: Joi.array(),
//   });

//   return schema.validate(data);
// };

import Joi from 'joi';

export const validateCreatePost = (data) => {
  const schema = Joi.object({
    content: Joi.string()
      .min(3)
      .max(5000)
      .required()
      .messages({
        'string.base': `"content" should be a type of 'text'`,
        'string.empty': `"content" cannot be an empty field`,
        'string.min': `"content" should have a minimum length of {#limit}`,
        'string.max': `"content" should have a maximum length of {#limit}`,
        'any.required': `"content" is a required field`
      }),
      
    mediaIds: Joi.array()
  });

  return schema.validate(data, { abortEarly: false }); // returns all errors, not just the first one
};
