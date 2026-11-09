package com.msoa.catalog.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record UpdateProductRequest(
        @NotBlank String name,
        @NotBlank String category,
        @NotNull @DecimalMin("0.0") BigDecimal price,
        String image,
        String description
) {}
